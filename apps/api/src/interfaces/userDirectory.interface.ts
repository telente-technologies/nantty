import type { CurrencyCode } from "../enums/currency.enum.js";

export interface UserSummary {
  readonly id: string;
  readonly username: string;
  readonly name: string;
  readonly avatarUrl: string | null;
  readonly isSeller: boolean;
}

export interface UserContact {
  readonly id: string;
  readonly email: string | null;
  readonly name: string;
  readonly notificationPreferences: Readonly<Record<string, boolean>>;
}

export interface UserLocalePreference {
  readonly countryCode: string | null;
  readonly currency: CurrencyCode | null;
}

export interface UserDirectory {
  findUserLocalePreference(userId: string): Promise<UserLocalePreference | undefined>;
  findUserSummaries(userIds: readonly string[]): Promise<readonly UserSummary[]>;
  findUserContact(userId: string): Promise<UserContact | undefined>;
  searchUsers(term: string, limit: number): Promise<readonly UserSummary[]>;
  grantRole(userId: string, role: string): Promise<void>;
  listSelectedTopicSlugs(userId: string): Promise<readonly string[]>;
  findTopicSlugById(topicId: string): Promise<string | undefined>;
}
