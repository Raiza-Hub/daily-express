import { createServiceError } from "@shared/utils";
import { db, type DbTransaction } from "../db/connection";
import { origin, destination, type OriginRecord, type DestinationRecord } from "../db/index";
import { RouteRepository } from "./route.repository";

type RouteInsert = typeof origin.$inferInsert;

export interface CreateOriginInput {
  title: string;
  locality: string;
  meetingPoint: string;
  departureTime: string[];
  price: number;
  fee: number;
  luggageFee: number;
  destinationIds: string[];
  status: "inactive" | "pending" | "active";
}

export interface UpdateOriginInput {
  title?: string;
  locality?: string;
  meetingPoint?: string;
  departureTime?: string[];
  price?: number;
  fee?: number;
  luggageFee?: number;
  destinationIds?: string[];
  status?: "inactive" | "pending" | "active";
}

export interface CreateDestinationInput {
  title: string;
  locality: string;
}

export interface UpdateDestinationInput {
  title?: string;
  locality?: string;
  status?: "inactive" | "pending" | "active";
}

export class RouteCrudService {
  private readonly repo: RouteRepository;

  constructor(repo: RouteRepository) {
    this.repo = repo;
  }

  async createOrigin(input: CreateOriginInput): Promise<OriginRecord> {
    if (!input.destinationIds || input.destinationIds.length === 0) {
      throw createServiceError("Origin must reference at least one destination", 400);
    }

    const existing = await this.repo.findOriginConflict({
      title: input.title,
      locality: input.locality,
    });
    if (existing) {
      throw createServiceError("An origin with this title and locality already exists", 409);
    }

    const values: RouteInsert = {
      title: input.title,
      locality: input.locality,
      meetingPoint: input.meetingPoint,
      departureTime: input.departureTime,
      price: input.price,
      fee: input.fee,
      luggageFee: input.luggageFee,
      destinationIds: input.destinationIds,
      status: input.status,
    };

    return db.transaction(async (tx) => {
      return this.repo.insertOrigin(tx, values);
    });
  }

  async getAllOrigins(): Promise<Array<OriginRecord>> {
    return db.query.origin.findMany({
      orderBy: (fields, { desc }) => [desc(fields.createdAt)],
    });
  }

  async updateOrigin(originId: string, input: UpdateOriginInput): Promise<OriginRecord> {
    const existing = await this.repo.findOriginById(originId);
    if (!existing) {
      throw createServiceError("Origin not found", 404);
    }

    const updateData: Partial<RouteInsert> = {};
    if (input.title !== undefined) updateData.title = input.title;
    if (input.locality !== undefined) updateData.locality = input.locality;
    if (input.meetingPoint !== undefined) updateData.meetingPoint = input.meetingPoint;
    if (input.departureTime !== undefined) updateData.departureTime = input.departureTime;
    if (input.price !== undefined) updateData.price = input.price;
    if (input.fee !== undefined) updateData.fee = input.fee;
    if (input.luggageFee !== undefined) updateData.luggageFee = input.luggageFee;
    if (input.destinationIds !== undefined) updateData.destinationIds = input.destinationIds;
    if (input.status !== undefined) updateData.status = input.status;

    return db.transaction(async (tx) => {
      return this.repo.updateOrigin(tx, originId, updateData);
    });
  }

  async deactivateOrigin(originId: string): Promise<void> {
    const existing = await this.repo.findOriginById(originId);
    if (!existing) {
      throw createServiceError("Origin not found", 404);
    }

    await db.transaction(async (tx) => {
      await this.repo.deactivateOrigin(tx, originId);
    });
  }

  async createDestination(input: CreateDestinationInput): Promise<DestinationRecord> {
    const existing = await this.repo.findDestinationConflict({
      title: input.title,
      locality: input.locality,
    });
    if (existing) {
      throw createServiceError("A destination with this title and locality already exists", 409);
    }

    return db.transaction(async (tx) => {
      return this.repo.insertDestination(tx, {
        title: input.title,
        locality: input.locality,
      });
    });
  }

  async getAllDestinations(): Promise<DestinationRecord[]> {
    return db.query.destination.findMany({
      orderBy: (fields, { desc }) => [desc(fields.createdAt)],
    });
  }

  async updateDestination(
    destinationId: string,
    input: UpdateDestinationInput,
  ): Promise<DestinationRecord> {
    const existing = await this.repo.findDestinationById(destinationId);
    if (!existing) {
      throw createServiceError("Destination not found", 404);
    }

    const updateData: Partial<typeof destination.$inferInsert> = {};
    if (input.title !== undefined) updateData.title = input.title;
    if (input.locality !== undefined) updateData.locality = input.locality;
    if (input.status !== undefined) updateData.status = input.status;

    return db.transaction(async (tx) => {
      return this.repo.updateDestination(tx, destinationId, updateData);
    });
  }

  async deactivateDestination(destinationId: string): Promise<void> {
    const existing = await this.repo.findDestinationById(destinationId);
    if (!existing) {
      throw createServiceError("Destination not found", 404);
    }

    await db.transaction(async (tx) => {
      await this.repo.deactivateDestination(tx, destinationId);
    });
  }
}
export const routeCrudService = new RouteCrudService(new RouteRepository());
