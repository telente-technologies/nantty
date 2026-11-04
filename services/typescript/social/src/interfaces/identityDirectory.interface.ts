export type WhoCanMentionMe = "everyone" | "following" | "no_one";
export type MentionTargetStatus = "active" | "suspended" | "deleted";

export type CheckmarkColor = "blue" | "gold" | "black";

export interface UserSummary {
  readonly id: string;
  readonly name: string;
  readonly username: string;
  readonly avatarUrl: string | null;
  readonly verified: boolean;
  readonly isCreator: boolean;
}

export interface OwnedProfileSummary {
  readonly id: string;
  readonly accountId: string;
  readonly kind: string;
  readonly displayName: string;
  readonly handle: string;
  readonly avatarUrl: string | null;
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
  findCheckmarkColors(accountIds: readonly string[]): Promise<ReadonlyMap<string, CheckmarkColor>>;
  findProfileCheckmarkColors(profileIds: readonly string[]): Promise<ReadonlyMap<string, CheckmarkColor>>;
  findAccountCreatedAt(accountId: string): Promise<Date | undefined>;
  findOwnedPostableProfile(accountId: string, profileId: string, purpose?: "publish" | "manage"): Promise<OwnedProfileSummary | null>;
  findProfilesByIds(profileIds: readonly string[]): Promise<ReadonlyMap<string, OwnedProfileSummary>>;
}
