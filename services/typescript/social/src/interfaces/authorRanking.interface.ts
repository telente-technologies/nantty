import type { AuthorRankingTier } from "../constants/ranking.constant.js";

export interface AuthorRankingProfile {
  readonly tier: AuthorRankingTier;
  readonly isOfficial: boolean;
  readonly countryCode: string | null;
}

export interface AuthorRankingDirectory {
  findAuthorRankingProfiles(accountIds: readonly string[]): Promise<ReadonlyMap<string, AuthorRankingProfile>>;
  findAccountCreatedDates(accountIds: readonly string[]): Promise<ReadonlyMap<string, Date>>;
  findSuspendedAccountIds(accountIds: readonly string[]): Promise<ReadonlySet<string>>;
}
