import { getSignedInMockUser } from "./fixtures.mock";

const DAY_IN_MS = 86_400_000;

export interface TrustStats {
  readonly realFollowers: number;
  readonly idVerified: boolean;
  readonly businessVerified: boolean;
  readonly hasActiveStore: boolean;
  readonly successRatePercent: number;
  readonly originalPostsLast60Days: number;
  readonly violationsLast90Days: number;
  readonly flaggedForRisk: boolean;
}

const TRUST_STATS_BY_USER_ID: Record<string, TrustStats> = {
  u_me: { realFollowers: 6_840, idVerified: true, businessVerified: true, hasActiveStore: true, successRatePercent: 97, originalPostsLast60Days: 31, violationsLast90Days: 0, flaggedForRisk: false },
  u_buyer: { realFollowers: 1_240, idVerified: true, businessVerified: false, hasActiveStore: false, successRatePercent: 0, originalPostsLast60Days: 7, violationsLast90Days: 0, flaggedForRisk: false },
};

const FALLBACK_STATS: TrustStats = { realFollowers: 0, idVerified: false, businessVerified: false, hasActiveStore: false, successRatePercent: 0, originalPostsLast60Days: 0, violationsLast90Days: 0, flaggedForRisk: false };

export const trustStatsForSignedInUser = (): TrustStats => TRUST_STATS_BY_USER_ID[getSignedInMockUser().id] ?? FALLBACK_STATS;

export const accountAgeInDaysForSignedInUser = () => Math.floor((Date.now() - new Date(getSignedInMockUser().joinedAt).getTime()) / DAY_IN_MS);
