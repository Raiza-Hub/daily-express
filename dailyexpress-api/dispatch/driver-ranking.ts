export const RANKING_WEIGHTS = {
  fairness: 0.4,
  acceptance: 0.35,
  completion: 0.25,
} as const;

export const PRIOR_ACCEPTANCE_RATE = 0.7;
export const PRIOR_WEIGHT = 5;
export const NEW_DRIVER_MIN_TRIPS = 10;
export const OFFER_HISTORY_WINDOW_DAYS = 30;
export const OFFER_PRESSURE_CAP = 10;

const FAIRNESS_RECENCY_WEIGHT = 0.7;
const FAIRNESS_PRESSURE_WEIGHT = 0.3;

const DAY_MS = 24 * 60 * 60 * 1_000;
const IDLE_SATURATION_MS = OFFER_HISTORY_WINDOW_DAYS * DAY_MS;

export type DriverRankingInput = {
  id: string;
  offers: number;
  answered: number;
  accepted: number;
  lastOfferedAt: Date | null;
  completedTrips: number;
  cancelledTrips: number;
};

export type DriverScoreBreakdown = {
  rankingScore: number;
  fairnessScore: number;
  acceptanceScore: number;
  completionScore: number;
  isNew: boolean;
};

export type RankedCandidate<T extends object = object> = T & DriverScoreBreakdown;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function posteriorRate(successes: number, observations: number): number {
  const observed = Math.max(0, observations);
  const hits = Math.min(Math.max(0, successes), observed);
  return (hits + PRIOR_ACCEPTANCE_RATE * PRIOR_WEIGHT) / (observed + PRIOR_WEIGHT);
}

export function fairnessScore(input: {
  lastOfferedAt: Date | null;
  answered: number;
  now: Date;
}): number {
  if (!input.lastOfferedAt) return 1;

  const idleGap = input.now.getTime() - input.lastOfferedAt.getTime();
  const recency = clamp01(idleGap / IDLE_SATURATION_MS);
  const pressure = clamp01(input.answered / OFFER_PRESSURE_CAP);

  return (
    FAIRNESS_RECENCY_WEIGHT * recency + FAIRNESS_PRESSURE_WEIGHT * (1 - pressure)
  );
}

export function scoreCandidate(
  input: DriverRankingInput,
  now: Date = new Date(),
): DriverScoreBreakdown {
  const fairness = fairnessScore({
    lastOfferedAt: input.lastOfferedAt,
    answered: input.answered,
    now,
  });
  const acceptanceScore = posteriorRate(input.accepted, input.answered);
  const completionScore = posteriorRate(
    input.completedTrips,
    input.completedTrips + input.cancelledTrips,
  );

  return {
    rankingScore:
      RANKING_WEIGHTS.fairness * fairness +
      RANKING_WEIGHTS.acceptance * acceptanceScore +
      RANKING_WEIGHTS.completion * completionScore,
    fairnessScore: fairness,
    acceptanceScore,
    completionScore,
    isNew:
      input.offers === 0 &&
      input.completedTrips + input.cancelledTrips < NEW_DRIVER_MIN_TRIPS,
  };
}

export function rankDrivers<T extends object>(
  candidates: (T & DriverRankingInput)[],
  now: Date = new Date(),
): RankedCandidate<T & DriverRankingInput>[] {
  return candidates
    .map((candidate) => ({ ...candidate, ...scoreCandidate(candidate, now) }))
    .sort((left, right) => {
      if (right.rankingScore !== left.rankingScore) {
        return right.rankingScore - left.rankingScore;
      }
      return left.id.localeCompare(right.id);
    });
}