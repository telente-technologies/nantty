import { findMockPlatformUser, readMockAreaStore } from "@/mocks/mockDatabase.mock";
import { MockHttpError } from "@/mocks/mockResponses.mock";
import { presentPlatformUserSummary, type MockPlatformUserRecord } from "@/mocks/seed/demoPlatformUsers.mock";
import { buildDemoAdPolicies, buildDemoAdsForReview, buildDemoAdvertisers, type MockAdPolicyRecord, type MockAdRecord, type MockAdvertiserRecord } from "@/mocks/seed/trustAds.mock";
import { buildDemoTrustAppeals, type MockAppealRecord } from "@/mocks/seed/trustAppeals.mock";
import { buildDemoCopyrightClaims, type MockCopyrightClaimRecord } from "@/mocks/seed/trustCopyright.mock";
import { buildDemoTrustReports, type MockReportRecord } from "@/mocks/seed/trustReports.mock";
import { isoMinutesAgo } from "@/mocks/seed/trustTime.mock";
import type { PriorAuthorAction } from "@/types/moderation.type";
import type { PlatformUserSummary } from "@/types/platformUser.type";

export interface TrustMockStore {
  readonly reports: MockReportRecord[];
  readonly appeals: MockAppealRecord[];
  readonly copyrightClaims: MockCopyrightClaimRecord[];
  readonly ads: MockAdRecord[];
  readonly advertisers: MockAdvertiserRecord[];
  readonly adPolicies: MockAdPolicyRecord[];
  readonly strikeAdjustmentsByUserId: Map<string, number>;
  readonly authorActionsByUserId: Map<string, PriorAuthorAction[]>;
}

export function readTrustStore(): TrustMockStore {
  return readMockAreaStore<TrustMockStore>("trust", () => ({
    reports: buildDemoTrustReports(),
    appeals: buildDemoTrustAppeals(),
    copyrightClaims: buildDemoCopyrightClaims(),
    ads: buildDemoAdsForReview(),
    advertisers: buildDemoAdvertisers(),
    adPolicies: buildDemoAdPolicies(),
    strikeAdjustmentsByUserId: new Map([["usr_0016", 1]]),
    authorActionsByUserId: new Map([
      ["usr_0005", [{ action: "WARN_AUTHOR", reason: "Listing without a clear return policy.", occurredAt: isoMinutesAgo(40_000) }, { action: "WARN_AUTHOR", reason: "Used a brand logo without permission.", occurredAt: isoMinutesAgo(12_000) }]],
      ["usr_0012", [{ action: "REMOVE", reason: "Replica luxury watches.", occurredAt: isoMinutesAgo(7600) }, { action: "SUSPEND_AUTHOR", reason: "Repeated counterfeit listings after two warnings.", occurredAt: isoMinutesAgo(2900) }]],
      ["usr_0016", [{ action: "COPYRIGHT_STRIKE", reason: "Reuploaded a music video.", occurredAt: isoMinutesAgo(60_000) }]],
    ]),
  }));
}

export function findPlatformUserRecordOrFail(userId: string): MockPlatformUserRecord {
  const user = findMockPlatformUser(userId);
  if (!user) throw new MockHttpError(404, "USER_NOT_FOUND", "The user linked to this item no longer exists.");
  return user;
}

export function readEffectiveStrikeCount(userId: string): number {
  const user = findMockPlatformUser(userId);
  return (user?.strikeCount ?? 0) + (readTrustStore().strikeAdjustmentsByUserId.get(userId) ?? 0);
}

export function presentModeratedUser(userId: string): PlatformUserSummary {
  const summary = presentPlatformUserSummary(findPlatformUserRecordOrFail(userId));
  return { ...summary, strikeCount: readEffectiveStrikeCount(userId) };
}

export function changeUserStrikeCount(userId: string, delta: number): number {
  const adjustments = readTrustStore().strikeAdjustmentsByUserId;
  adjustments.set(userId, (adjustments.get(userId) ?? 0) + delta);
  return readEffectiveStrikeCount(userId);
}

export function applyModerationStateToPlatformUser(userId: string, patch: Partial<Pick<MockPlatformUserRecord, "status" | "verification">>): void {
  Object.assign(findPlatformUserRecordOrFail(userId) as { -readonly [Key in keyof MockPlatformUserRecord]: MockPlatformUserRecord[Key] }, patch);
}

export function recordPriorActionOnAuthor(userId: string, action: string, reason: string): void {
  const actions = readTrustStore().authorActionsByUserId;
  actions.set(userId, [{ action, reason, occurredAt: new Date().toISOString() }, ...(actions.get(userId) ?? [])]);
}

export function readPriorActionsOnAuthor(userId: string): PriorAuthorAction[] {
  return readTrustStore().authorActionsByUserId.get(userId) ?? [];
}

export function findRecordByIdOrFail<Record extends { readonly id: string }>(records: readonly Record[], id: string | undefined, what: string): Record {
  const record = records.find((candidate) => candidate.id === id);
  if (!record) throw new MockHttpError(404, "NOT_FOUND", `${what} was not found.`);
  return record;
}
