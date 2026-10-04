export type WhoCanMentionMe = "everyone" | "following" | "no_one";
export type MentionTargetStatus = "active" | "suspended" | "deleted";

export interface UserSummary {
  readonly id: string;
  readonly name: string;
  readonly username: string;
  readonly avatarUrl: string | null;
  readonly verified: boolean;
  readonly isCreator: boolean;
}

export interface IdentityDirectory {
  findUserSummaries(accountIds: readonly string[]): Promise<ReadonlyMap<string, UserSummary>>;
  findAccountIdsByUsernames(usernames: readonly string[]): Promise<ReadonlyMap<string, string>>;
  searchUserSummaries(term: string, limit: number): Promise<readonly UserSummary[]>;
  findPrivateAccountIds(accountIds: readonly string[]): Promise<ReadonlySet<string>>;
  findMentionPrivacy(accountIds: readonly string[]): Promise<ReadonlyMap<string, WhoCanMentionMe>>;
  findMentionTargetStatuses(accountIds: readonly string[]): Promise<ReadonlyMap<string, { readonly username: string | null; readonly status: MentionTargetStatus }>>;
  hasPersonalizationConsent(accountId: string): Promise<boolean>;
  findAccountsAllowingPersonalizedAds(accountIds: readonly string[]): Promise<ReadonlySet<string>>;
  findAccountCreatedAt(accountId: string): Promise<Date | undefined>;
}
