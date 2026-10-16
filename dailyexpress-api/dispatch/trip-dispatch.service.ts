import { randomUUID } from "node:crypto";
import {
  and,
  asc,
  eq,
  gte,
  inArray,
  isNull,
  notInArray,
  sql,
  type SQL,
  type SQLWrapper,
} from "drizzle-orm";
import { db, type DbTransaction } from "../db/connection";
import {
  destination,
  driver,
  driverDispatchAttempt,
  earning,
  origin,
  trip,
  tripDispatch,
  type DriverDispatchAttemptRecord,
  type DriverRecord,
  type TripDispatchRecord,
  type TripRecord,
} from "../db/index";
import { logger } from "../utils/logger";
import { jobService } from "../workers/job.service";
import type { TripDispatchJobData } from "../workers/boss";
import { tripCancellationService } from "../route/trip-cancellation.service";
import {
  africasTalkingVoiceClient,
  AfricasTalkingVoiceClient,
} from "./africas-talking-voice.client";
import {
  buildOfferPromptLines,
  classifyCallOutcome,
  MAX_CALL_RETRIES,
  nextCallRetryAt,
  OFFER_VOICE,
  type CallOutcome,
} from "./dispatch-policy";
import {
  OFFER_HISTORY_WINDOW_DAYS,
  rankDrivers,
  type DriverRankingInput,
  type RankedCandidate,
} from "./driver-ranking";

type AttemptToDial = {
  id: string;
  clientRequestId: string;
  phone: string;
};

type OfferDetails = {
  originTitle: string;
  destinationTitle: string;
  meetingPoint: string;
  tripDate: string;
  departureTime: string;
  capacity: number;
  amount: number;
  currency: string;
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function likePattern(value: string): string {
  return `%${value.replace(/([\\%_])/g, "\\$1")}%`;
}

function localityMatches(column: SQLWrapper, locality: string): SQL {
  const pattern = likePattern(locality.trim());
  return sql`(btrim(${column}) ILIKE ${pattern} ESCAPE '\\')`;
}

const SEARCH_WINDOW_MS = 30 * 60 * 1_000;
const RECHECK_INTERVAL_MS = 120 * 1_000;
const DAY_MS = 24 * 60 * 60 * 1_000;
const RANKING_AUDIT_LIMIT = 5;
const ACTIVE_ATTEMPT_STATUSES: DriverDispatchAttemptRecord["status"][] = [
  "dialing",
  "awaiting_dtmf",
];
const TERMINAL_TRIP_STATUSES: TripRecord["status"][] = ["cancelled", "completed"];
const COMPLETION_TRIP_STATUSES: TripRecord["status"][] = [
  "completed",
  "cancelled",
];
const EMPTY_RANKING_STATS: Omit<DriverRankingInput, "id"> = {
  offers: 0,
  answered: 0,
  accepted: 0,
  lastOfferedAt: null,
  completedTrips: 0,
  cancelledTrips: 0,
};

export type VoiceCallbackPayload = {
  clientRequestId?: string;
  isActive?: string;
  status?: string;
  hangupCause?: string;
  direction?: string;
  dtmfDigits?: string;
};

export class TripDispatchService {
  constructor(private voiceClient: AfricasTalkingVoiceClient) {}

  async trackTripAfterBooking(
    tx: DbTransaction,
    tripId: string,
  ): Promise<void> {
    const tripRecord = await this.findTrip(tx, tripId);
    if (!tripRecord || tripRecord.status !== "awaiting_driver") return;

    const [created] = await tx
      .insert(tripDispatch)
      .values({ tripId })
      .onConflictDoNothing({ target: tripDispatch.tripId })
      .returning();

    const dispatch = created ?? (await this.lockDispatchByTrip(tx, tripId));
    if (!dispatch) return;

    const lockedTrip = await this.lockTrip(tx, tripId);
    if (!lockedTrip || lockedTrip.status !== "awaiting_driver") return;

    const now = new Date();
    const shouldOpen =
      lockedTrip.bookedSeats >= lockedTrip.capacity &&
      !lockedTrip.driverId &&
      dispatch.status === "pending";
    const deadlineAt = shouldOpen
      ? new Date(now.getTime() + SEARCH_WINDOW_MS)
      : dispatch.deadlineAt;

    if ((created || shouldOpen) && deadlineAt) {
      await jobService.enqueueTripDispatch(
        tx,
        { action: "guard", tripId },
        { startAfter: deadlineAt },
      );
    }

    if (shouldOpen) {
      await tx
        .update(tripDispatch)
        .set({ status: "searching", deadlineAt, updatedAt: now })
        .where(eq(tripDispatch.id, dispatch.id));
      await jobService.enqueueTripDispatch(tx, {
        action: "advance",
        tripId,
      });
      logger.info("trip_dispatch.opened", {
        tripId,
        bookedSeats: lockedTrip.bookedSeats,
      });
    }
  }

  async processJob(job: TripDispatchJobData): Promise<void> {
    switch (job.action) {
      case "advance":
        await this.advance(job.tripId);
        return;
      case "retry":
        if (job.attemptId) await this.retry(job.attemptId);
        return;
      case "guard":
        await this.guard(job.tripId);
        return;
    }
  }

  async handleVoiceCallback(payload: VoiceCallbackPayload): Promise<string> {
    logger.info("trip_dispatch.voice_callback", {
      clientRequestId: payload.clientRequestId,
      isActive: payload.isActive,
      status: payload.status,
      hangupCause: payload.hangupCause,
      direction: payload.direction,
      dtmfDigits: payload.dtmfDigits,
    });

    if (payload.direction === "Inbound") {
      return this.rejectedCallXml();
    }

    if (payload.dtmfDigits !== undefined) {
      return this.handleCallbackDtmf(payload);
    }

    if (payload.isActive !== "1") {
      await this.handleCallEnded(payload);
      return "";
    }

    const prompted = await db.transaction(async (tx) => {
      if (!payload.clientRequestId) return null;

      const located = await this.locateAttemptByClientRequestId(
        tx,
        payload.clientRequestId,
      );
      if (!located) return null;

      const dispatch = await this.lockDispatch(tx, located.dispatchId);
      const lockedTrip = dispatch
        ? await this.lockTrip(tx, dispatch.tripId)
        : null;
      const attempt = await this.lockAttempt(tx, located.id);
      if (!dispatch || !lockedTrip || !attempt) return null;
      if (dispatch.status !== "searching" || lockedTrip.driverId) {
        return null;
      }
      if (!ACTIVE_ATTEMPT_STATUSES.includes(attempt.status)) return null;
      if (attempt.status === "awaiting_dtmf") {
        return { attempt, offer: await this.getOfferDetails(tx, lockedTrip) };
      }

      const [updated] = await tx
        .update(driverDispatchAttempt)
        .set({ status: "awaiting_dtmf", updatedAt: new Date() })
        .where(eq(driverDispatchAttempt.id, attempt.id))
        .returning();
      if (!updated) return null;

      return {
        attempt: updated,
        offer: await this.getOfferDetails(tx, lockedTrip),
      };
    });

    if (!prompted) return this.closedCallXml();
    return this.dtmfPromptXml(prompted.offer);
  }

  async handleDtmf(attemptId: string, digits: string | undefined): Promise<string> {
    const pressed = digits?.match(/[0-9]/)?.[0];
    logger.info("trip_dispatch.dtmf_received", { attemptId, pressed });
    if (pressed === "1" && (await this.acceptAttempt(attemptId))) {
      return this.acceptedCallXml();
    }

    await this.resolveAttempt(attemptId, "declined");
    return this.closedCallXml();
  }

  private async handleCallbackDtmf(
    payload: VoiceCallbackPayload,
  ): Promise<string> {
    const clientRequestId = payload.clientRequestId;
    if (!clientRequestId) return this.closedCallXml();

    const located = await db.transaction(async (tx) =>
      this.locateAttemptByClientRequestId(tx, clientRequestId),
    );
    if (!located) return this.closedCallXml();

    return this.handleDtmf(located.id, payload.dtmfDigits);
  }

  private async advance(tripId: string): Promise<void> {
    const attempt = await db.transaction(async (tx) => {
      const dispatch = await this.lockDispatchByTrip(tx, tripId);
      const lockedTrip = dispatch ? await this.lockTrip(tx, dispatch.tripId) : null;
      if (!dispatch || !lockedTrip || dispatch.status !== "searching") return null;

      if (lockedTrip.driverId) {
        await this.markDispatchAssigned(tx, dispatch.id);
        return null;
      }
      if (this.searchExpired(dispatch)) return null;

      const activeAttempt = await this.findActiveAttemptForDispatch(
        tx,
        dispatch.id,
      );
      if (activeAttempt) {
        await this.scheduleAdvance(tx, dispatch);
        return null;
      }

      const candidates = await this.findEligibleCandidates(
        tx,
        dispatch,
        lockedTrip,
      );

      logger.info("trip_dispatch.ranked", {
        tripId,
        candidateCount: candidates.length,
        top: candidates.slice(0, RANKING_AUDIT_LIMIT).map((candidate) => ({
          driverId: candidate.id,
          rankingScore: Number(candidate.rankingScore.toFixed(4)),
          fairnessScore: Number(candidate.fairnessScore.toFixed(4)),
          acceptanceScore: Number(candidate.acceptanceScore.toFixed(4)),
          completionScore: Number(candidate.completionScore.toFixed(4)),
          isNew: candidate.isNew,
        })),
      });

      for (const candidate of candidates) {
        const created = await this.createAttempt(
          tx,
          dispatch,
          lockedTrip,
          candidate,
          0,
        );
        if (created) return created;
      }

      await this.scheduleAdvance(tx, dispatch);
      return null;
    });

    if (attempt) await this.dial(attempt);
  }

  private async retry(previousAttemptId: string): Promise<void> {
    const attempt = await db.transaction(async (tx) => {
      const located = await this.locateAttempt(tx, previousAttemptId);
      if (!located) return null;

      const dispatch = await this.lockDispatch(tx, located.dispatchId);
      const lockedTrip = dispatch ? await this.lockTrip(tx, dispatch.tripId) : null;
      const previous = await this.lockAttempt(tx, previousAttemptId);
      if (!dispatch || !lockedTrip || !previous) return null;
      if (dispatch.status !== "searching" || lockedTrip.driverId) {
        return null;
      }
      if (this.searchExpired(dispatch)) return null;
      if (previous.retryNumber >= MAX_CALL_RETRIES) return null;

      const candidate = await this.lockEligibleDriver(tx, previous.driverId);
      if (!candidate) {
        await this.scheduleAdvance(tx, dispatch);
        return null;
      }

      const created = await this.createAttempt(
        tx,
        dispatch,
        lockedTrip,
        candidate,
        previous.retryNumber + 1,
      );
      if (!created) {
        await this.scheduleAdvance(tx, dispatch);
      }
      return created;
    });

    if (attempt) await this.dial(attempt);
  }

  private async dial(attempt: AttemptToDial): Promise<void> {
    try {
      await this.voiceClient.call({
        to: attempt.phone,
        clientRequestId: attempt.clientRequestId,
      });
      logger.info("trip_dispatch.call_submitted", { attemptId: attempt.id });
    } catch (error) {
      logger.warn("trip_dispatch.call_failed", {
        attemptId: attempt.id,
        error: error instanceof Error ? error.message : String(error),
      });
      await this.resolveAttempt(attempt.id, "unavailable");
    }
  }

  private async handleCallEnded(payload: VoiceCallbackPayload): Promise<void> {
    const clientRequestId = payload.clientRequestId;
    if (!clientRequestId) return;

    const attempt = await db.transaction(async (tx) =>
      this.locateAttemptByClientRequestId(tx, clientRequestId),
    );
    if (!attempt || !ACTIVE_ATTEMPT_STATUSES.includes(attempt.status)) return;

    await this.resolveAttempt(
      attempt.id,
      classifyCallOutcome({
        status: payload.status,
        hangupCause: payload.hangupCause,
      }),
    );
  }

  private async acceptAttempt(attemptId: string): Promise<boolean> {
    return db.transaction(async (tx) => {
      const located = await this.locateAttempt(tx, attemptId);
      if (!located) return false;

      const dispatch = await this.lockDispatch(tx, located.dispatchId);
      const lockedTrip = dispatch
        ? await this.lockTrip(tx, dispatch.tripId)
        : null;
      const attempt = await this.lockAttempt(tx, attemptId);
      if (!dispatch || !lockedTrip || !attempt) return false;
      if (attempt.status !== "awaiting_dtmf") return false;
      if (dispatch.status !== "searching" || lockedTrip.driverId) {
        return false;
      }

      const candidate = await this.lockEligibleDriver(tx, attempt.driverId);
      if (!candidate) return false;

      const [slotConflict] = await tx
        .select({ id: trip.id })
        .from(trip)
        .where(
          and(
            eq(trip.driverId, candidate.id),
            eq(trip.date, lockedTrip.date),
            eq(trip.departureTime, lockedTrip.departureTime),
            notInArray(trip.status, TERMINAL_TRIP_STATUSES),
          ),
        )
        .limit(1);
      if (slotConflict) return false;

      const now = new Date();
      await tx
        .update(trip)
        .set({ driverId: candidate.id, updatedAt: now })
        .where(eq(trip.id, lockedTrip.id));
      await tx
        .update(driverDispatchAttempt)
        .set({ status: "accepted", updatedAt: now })
        .where(eq(driverDispatchAttempt.id, attempt.id));
      await this.markDispatchAssigned(tx, dispatch.id, now);

      logger.info("trip_dispatch.driver_assigned", {
        tripId: lockedTrip.id,
        driverId: candidate.id,
        attemptId,
      });
      return true;
    });
  }

  private async resolveAttempt(
    attemptId: string,
    outcome: CallOutcome,
  ): Promise<void> {
    const action = await db.transaction(async (tx) => {
      const located = await this.locateAttempt(tx, attemptId);
      if (!located) return null;

      const dispatch = await this.lockDispatch(tx, located.dispatchId);
      const attempt = await this.lockAttempt(tx, attemptId);
      if (!dispatch || !attempt) return null;
      if (!ACTIVE_ATTEMPT_STATUSES.includes(attempt.status)) return null;
      if (dispatch.status !== "searching") return null;

      const now = new Date();
      await tx
        .update(driverDispatchAttempt)
        .set({ status: outcome, updatedAt: now })
        .where(eq(driverDispatchAttempt.id, attempt.id));

      if (this.searchExpired(dispatch)) {
        return { cancel: true as const, tripId: dispatch.tripId };
      }

      const retryAt = nextCallRetryAt({
        outcome,
        retryNumber: attempt.retryNumber,
        now,
        deadlineAt: dispatch.deadlineAt,
      });
      if (retryAt) {
        await jobService.enqueueTripDispatch(
          tx,
          { action: "retry", tripId: dispatch.tripId, attemptId: attempt.id },
          { startAfter: retryAt },
        );
        return null;
      }

      await this.scheduleAdvance(tx, dispatch);
      return null;
    });

    if (action?.cancel) await this.cancelDriverlessDispatch(action.tripId);
  }

  private async guard(tripId: string): Promise<void> {
    const shouldCancel = await db.transaction(async (tx) => {
      const dispatch = await this.lockDispatchByTrip(tx, tripId);
      if (!dispatch) return false;
      if (dispatch.status === "assigned" || dispatch.status === "cancelled") {
        return false;
      }
      if (!dispatch.deadlineAt) return false;

      if (!this.searchExpired(dispatch)) {
        await jobService.enqueueTripDispatch(
          tx,
          { action: "guard", tripId },
          { startAfter: dispatch.deadlineAt },
        );
        return false;
      }

      const live = await this.findActiveAttemptForDispatch(tx, dispatch.id);
      if (live && live.status === "awaiting_dtmf") return false;

      return true;
    });

    if (shouldCancel) await this.cancelDriverlessDispatch(tripId);
  }

  private async cancelDriverlessDispatch(tripId: string): Promise<void> {
    const cancelled = await db.transaction(async (tx) => {
      const dispatch = await this.lockDispatchByTrip(tx, tripId);
      if (
        !dispatch ||
        dispatch.status === "assigned" ||
        dispatch.status === "cancelled"
      ) {
        return false;
      }

      const updatedTrip = await tripCancellationService.cancelInTransaction(
        tx,
        tripId,
        {
          requireDriverless: true,
          refundReason: "Trip cancelled because no driver was found",
          emailReason: "no_driver_found",
        },
      );
      if (!updatedTrip) return false;

      await tx
        .update(driverDispatchAttempt)
        .set({ status: "unavailable", updatedAt: new Date() })
        .where(
          and(
            eq(driverDispatchAttempt.dispatchId, dispatch.id),
            inArray(driverDispatchAttempt.status, ACTIVE_ATTEMPT_STATUSES),
          ),
        );

      await tx
        .update(tripDispatch)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(eq(tripDispatch.id, dispatch.id));
      return true;
    });

    if (cancelled) logger.info("trip_dispatch.cancelled", { tripId });
  }

  private searchExpired(dispatch: TripDispatchRecord): boolean {
    return (
      dispatch.deadlineAt !== null &&
      dispatch.deadlineAt.getTime() <= Date.now()
    );
  }

  private async scheduleAdvance(
    tx: DbTransaction,
    dispatch: TripDispatchRecord,
  ): Promise<void> {
    await jobService.enqueueTripDispatch(
      tx,
      { action: "advance", tripId: dispatch.tripId },
      { startAfter: new Date(Date.now() + RECHECK_INTERVAL_MS) },
    );
  }

  private async findEligibleCandidates(
    tx: DbTransaction,
    dispatch: TripDispatchRecord,
    lockedTrip: TripRecord,
  ): Promise<RankedCandidate<DriverRecord>[]> {
    const [tripOrigin] = await tx
      .select({ locality: origin.locality })
      .from(origin)
      .where(eq(origin.id, lockedTrip.originId))
      .limit(1);
    if (!tripOrigin) return [];

    const [drivers, assignedAtSlot, activeAttempts, priorAttempts] =
      await Promise.all([
        tx
          .select()
          .from(driver)
          .where(
            and(
              eq(driver.isActive, true),
              isNull(driver.deletedAt),
              eq(driver.kycStatus, "active"),
              localityMatches(driver.city, tripOrigin.locality),
            ),
          )
          .orderBy(asc(driver.id)),
        tx
          .select({ driverId: trip.driverId })
          .from(trip)
          .where(
            and(
              eq(trip.date, lockedTrip.date),
              eq(trip.departureTime, lockedTrip.departureTime),
              notInArray(trip.status, TERMINAL_TRIP_STATUSES),
            ),
          ),
        tx
          .select({ driverId: driverDispatchAttempt.driverId })
          .from(driverDispatchAttempt)
          .where(
            inArray(driverDispatchAttempt.status, ACTIVE_ATTEMPT_STATUSES),
          ),
        tx
          .select({ driverId: driverDispatchAttempt.driverId })
          .from(driverDispatchAttempt)
          .where(eq(driverDispatchAttempt.dispatchId, dispatch.id)),
      ]);

    const unavailable = new Set<string>();
    for (const assigned of assignedAtSlot) {
      if (assigned.driverId) unavailable.add(assigned.driverId);
    }
    for (const active of activeAttempts) unavailable.add(active.driverId);
    for (const prior of priorAttempts) unavailable.add(prior.driverId);

    const eligible = drivers.filter(
      (candidate) => !unavailable.has(candidate.id),
    );
    if (eligible.length === 0) return [];

    const now = new Date();
    const stats = await this.loadRankingStats(
      tx,
      eligible.map((candidate) => candidate.id),
      now,
    );

    return rankDrivers(
      eligible.map((candidate) => ({
        ...candidate,
        ...EMPTY_RANKING_STATS,
        ...(stats.get(candidate.id) ?? EMPTY_RANKING_STATS),
      })),
      now,
    );
  }

  private async loadRankingStats(
    tx: DbTransaction,
    driverIds: string[],
    now: Date,
  ): Promise<Map<string, Omit<DriverRankingInput, "id">>> {
    const stats = new Map<string, Omit<DriverRankingInput, "id">>();
    if (driverIds.length === 0) return stats;

    for (const driverId of driverIds) {
      stats.set(driverId, { ...EMPTY_RANKING_STATS });
    }

    const windowStart = new Date(
      now.getTime() - OFFER_HISTORY_WINDOW_DAYS * DAY_MS,
    );

    const [attemptRows, tripRows] = await Promise.all([
      tx
        .select({
          driverId: driverDispatchAttempt.driverId,
          status: driverDispatchAttempt.status,
          attempts: sql<number>`count(*)`.as("attempts"),
          latestOfferAt: sql<Date>`max(${driverDispatchAttempt.createdAt})`.as(
            "latestOfferAt",
          ),
        })
        .from(driverDispatchAttempt)
        .where(
          and(
            inArray(driverDispatchAttempt.driverId, driverIds),
            gte(driverDispatchAttempt.createdAt, windowStart),
          ),
        )
        .groupBy(driverDispatchAttempt.driverId, driverDispatchAttempt.status),
      tx
        .select({
          driverId: trip.driverId,
          status: trip.status,
        })
        .from(trip)
        .where(
          and(
            inArray(trip.driverId, driverIds),
            inArray(trip.status, COMPLETION_TRIP_STATUSES),
          ),
        ),
    ]);

    for (const row of attemptRows) {
      if (!row.driverId) continue;
      const bucket = stats.get(row.driverId) ?? { ...EMPTY_RANKING_STATS };
      const attempts = Number(row.attempts);
      bucket.offers += attempts;
      if (row.status === "accepted") {
        bucket.answered += attempts;
        bucket.accepted += attempts;
      }
      if (row.status === "declined") bucket.answered += attempts;

      const latest =
        row.latestOfferAt instanceof Date
          ? row.latestOfferAt
          : new Date(row.latestOfferAt);
      if (!bucket.lastOfferedAt || latest > bucket.lastOfferedAt) {
        bucket.lastOfferedAt = latest;
      }
      stats.set(row.driverId, bucket);
    }

    for (const row of tripRows) {
      if (!row.driverId) continue;
      const bucket = stats.get(row.driverId) ?? { ...EMPTY_RANKING_STATS };
      if (row.status === "completed") bucket.completedTrips += 1;
      if (row.status === "cancelled") bucket.cancelledTrips += 1;
      stats.set(row.driverId, bucket);
    }

    return stats;
  }

  private async createAttempt(
    tx: DbTransaction,
    dispatch: TripDispatchRecord,
    lockedTrip: TripRecord,
    candidate: DriverRecord,
    retryNumber: number,
  ): Promise<AttemptToDial | null> {
    const verified = await this.lockEligibleDriver(tx, candidate.id);
    if (!verified) return null;

    const [slotConflict, activeCall] = await Promise.all([
      tx
        .select({ id: trip.id })
        .from(trip)
        .where(
          and(
            eq(trip.driverId, verified.id),
            eq(trip.date, lockedTrip.date),
            eq(trip.departureTime, lockedTrip.departureTime),
            notInArray(trip.status, TERMINAL_TRIP_STATUSES),
          ),
        )
        .limit(1),
      tx
        .select({ id: driverDispatchAttempt.id })
        .from(driverDispatchAttempt)
        .where(
          and(
            eq(driverDispatchAttempt.driverId, verified.id),
            inArray(driverDispatchAttempt.status, ACTIVE_ATTEMPT_STATUSES),
          ),
        )
        .limit(1),
    ]);
    if (slotConflict.length > 0 || activeCall.length > 0) return null;

    const clientRequestId = randomUUID();
    const [attempt] = await tx
      .insert(driverDispatchAttempt)
      .values({
        dispatchId: dispatch.id,
        driverId: verified.id,
        clientRequestId,
        retryNumber,
        status: "dialing",
      })
      .onConflictDoNothing()
      .returning();
    if (!attempt) return null;

    return { id: attempt.id, clientRequestId, phone: verified.phone };
  }

  private async lockEligibleDriver(
    tx: DbTransaction,
    driverId: string,
  ): Promise<DriverRecord | null> {
    const [candidate] = await tx
      .select()
      .from(driver)
      .where(
        and(
          eq(driver.id, driverId),
          eq(driver.isActive, true),
          isNull(driver.deletedAt),
          eq(driver.kycStatus, "active"),
        ),
      )
      .for("update")
      .limit(1);
    return candidate ?? null;
  }

  private async findActiveAttemptForDispatch(
    tx: DbTransaction,
    dispatchId: string,
  ): Promise<DriverDispatchAttemptRecord | null> {
    const [attempt] = await tx
      .select()
      .from(driverDispatchAttempt)
      .where(
        and(
          eq(driverDispatchAttempt.dispatchId, dispatchId),
          inArray(driverDispatchAttempt.status, ACTIVE_ATTEMPT_STATUSES),
        ),
      )
      .for("update")
      .limit(1);
    return attempt ?? null;
  }

  private async getOfferDetails(
    tx: DbTransaction,
    lockedTrip: TripRecord,
  ): Promise<OfferDetails> {
    const [row] = await tx
      .select({
        originTitle: origin.title,
        destinationTitle: destination.title,
        meetingPoint: origin.meetingPoint,
        tripDate: trip.date,
        departureTime: trip.departureTime,
        capacity: trip.capacity,
        amount: earning.amount,
        currency: earning.currency,
      })
      .from(trip)
      .innerJoin(origin, eq(trip.originId, origin.id))
      .innerJoin(destination, eq(trip.destinationId, destination.id))
      .leftJoin(earning, eq(earning.tripId, trip.id))
      .where(eq(trip.id, lockedTrip.id))
      .limit(1);

    return {
      originTitle: row?.originTitle ?? "the origin",
      destinationTitle: row?.destinationTitle ?? "the destination",
      meetingPoint: row?.meetingPoint ?? "the meeting point",
      tripDate: row?.tripDate ?? lockedTrip.date,
      departureTime: row?.departureTime ?? lockedTrip.departureTime,
      capacity: row?.capacity ?? lockedTrip.capacity,
      amount: row?.amount ?? 0,
      currency: row?.currency ?? "NGN",
    };
  }

  private async findTrip(
    tx: DbTransaction,
    tripId: string,
  ): Promise<TripRecord | null> {
    const [record] = await tx
      .select()
      .from(trip)
      .where(eq(trip.id, tripId))
      .limit(1);
    return record ?? null;
  }

  private async lockTrip(
    tx: DbTransaction,
    tripId: string,
  ): Promise<TripRecord | null> {
    const [row] = await tx
      .select()
      .from(trip)
      .where(eq(trip.id, tripId))
      .for("update")
      .limit(1);
    return row ?? null;
  }

  private async lockDispatchByTrip(
    tx: DbTransaction,
    tripId: string,
  ): Promise<TripDispatchRecord | null> {
    const [dispatch] = await tx
      .select()
      .from(tripDispatch)
      .where(eq(tripDispatch.tripId, tripId))
      .for("update")
      .limit(1);
    return dispatch ?? null;
  }

  private async lockDispatch(
    tx: DbTransaction,
    dispatchId: string,
  ): Promise<TripDispatchRecord | null> {
    const [dispatch] = await tx
      .select()
      .from(tripDispatch)
      .where(eq(tripDispatch.id, dispatchId))
      .for("update")
      .limit(1);
    return dispatch ?? null;
  }

  private async lockAttempt(
    tx: DbTransaction,
    attemptId: string,
  ): Promise<DriverDispatchAttemptRecord | null> {
    const [lockedAttempt] = await tx
      .select()
      .from(driverDispatchAttempt)
      .where(eq(driverDispatchAttempt.id, attemptId))
      .for("update")
      .limit(1);
    return lockedAttempt ?? null;
  }

  private async locateAttempt(
    tx: DbTransaction,
    attemptId: string,
  ): Promise<{ id: string; dispatchId: string } | null> {
    const [row] = await tx
      .select({
        id: driverDispatchAttempt.id,
        dispatchId: driverDispatchAttempt.dispatchId,
      })
      .from(driverDispatchAttempt)
      .where(eq(driverDispatchAttempt.id, attemptId))
      .limit(1);
    return row ?? null;
  }

  private async locateAttemptByClientRequestId(
    tx: DbTransaction,
    clientRequestId: string,
  ): Promise<DriverDispatchAttemptRecord | null> {
    const [row] = await tx
      .select()
      .from(driverDispatchAttempt)
      .where(eq(driverDispatchAttempt.clientRequestId, clientRequestId))
      .limit(1);
    return row ?? null;
  }

  private async markDispatchAssigned(
    tx: DbTransaction,
    dispatchId: string,
    now = new Date(),
  ): Promise<void> {
    await tx
      .update(tripDispatch)
      .set({ status: "assigned", updatedAt: now })
      .where(eq(tripDispatch.id, dispatchId));
  }

  private dtmfPromptXml(offer: OfferDetails): string {
    const lines = buildOfferPromptLines({
      originTitle: offer.originTitle,
      destinationTitle: offer.destinationTitle,
      meetingPoint: offer.meetingPoint,
      tripDate: offer.tripDate,
      departureTime: offer.departureTime,
      amount: offer.amount,
      currency: offer.currency,
      capacity: offer.capacity,
    });
    const speech = lines
      .map((line) => `<s>${escapeXml(line)}</s>`)
      .join('<break time="400ms"/>');
    return `<?xml version="1.0" encoding="UTF-8"?><Response><GetDigits numDigits="1"><Say voice="${OFFER_VOICE}" playBeep="true"><speak><prosody rate="90%">${speech}</prosody></speak></Say></GetDigits><Say voice="${OFFER_VOICE}">We did not receive your response. Goodbye.</Say></Response>`;
  }

  private acceptedCallXml(): string {
    return `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="${OFFER_VOICE}">Trip accepted. You can view the trip details in your driver calendar dashboard.</Say></Response>`;
  }

  private closedCallXml(): string {
    return `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="${OFFER_VOICE}">This trip is no longer available. Goodbye.</Say></Response>`;
  }

  private rejectedCallXml(): string {
    return '<?xml version="1.0" encoding="UTF-8"?><Response><Reject/></Response>';
  }
}

export const tripDispatchService = new TripDispatchService(
  africasTalkingVoiceClient,
);