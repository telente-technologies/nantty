import { readMockAreaStore, readMockDatabase } from "@/mocks/mockDatabase.mock";
import { failNotFound } from "@/mocks/mockResponses.mock";
import { buildDemoProgramApplications, type MockProgramApplicationRecord } from "@/mocks/seed/peopleApplications.mock";
import { buildDemoReservedUsernames } from "@/mocks/seed/peopleReservedUsernames.mock";
import { buildDemoUserExtras, type MockUserExtras } from "@/mocks/seed/peopleUserExtras.mock";
import { buildDemoVerifications, type MockVerificationRecord } from "@/mocks/seed/peopleVerifications.mock";
import type { MockPlatformUserRecord } from "@/mocks/seed/demoPlatformUsers.mock";
import type { WithheldUsername } from "@/types/peopleUsers.type";
import type { UserVerificationSummary } from "@/types/platformUser.type";
import type { ReservedUsernameEntry } from "@/types/usernames.type";

export interface PeopleMockStore {
  readonly userExtras: Map<string, MockUserExtras>;
  readonly withheldUsernames: WithheldUsername[];
  readonly reservedUsernames: ReservedUsernameEntry[];
  readonly verifications: MockVerificationRecord[];
  readonly applications: MockProgramApplicationRecord[];
}

export function buildUserVerificationSummaryFromRecord(record: Pick<MockVerificationRecord, "color" | "tier" | "status">): UserVerificationSummary {
  return { color: record.color, tier: record.tier, status: record.status, badgeVisible: record.status === "VERIFIED" && record.tier !== "ESSENTIAL" };
}

export function applyVerificationRecordToPlatformUser(record: MockVerificationRecord): void {
  const user = readMockDatabase().platformUsers.find((candidate) => candidate.id === record.userId);
  if (!user) return;
  const summary = record.status === "UNVERIFIED" ? null : buildUserVerificationSummaryFromRecord(record);
  const mutableUser = user as { verification: UserVerificationSummary | null };
  if (summary === null && user.verification && user.verification.color !== record.color) return;
  mutableUser.verification = summary;
}

function createPeopleMockStore(): PeopleMockStore {
  const users = readMockDatabase().platformUsers;
  const verifications = buildDemoVerifications(users);
  verifications.forEach(applyVerificationRecordToPlatformUser);
  return {
    userExtras: buildDemoUserExtras(users),
    withheldUsernames: [],
    reservedUsernames: buildDemoReservedUsernames(),
    verifications,
    applications: buildDemoProgramApplications(users),
  };
}

export function readPeopleMockStore(): PeopleMockStore {
  return readMockAreaStore("people", createPeopleMockStore);
}

export function findPlatformUserForPeopleOrFail(userId: string | undefined): MockPlatformUserRecord {
  const user = readMockDatabase().platformUsers.find((candidate) => candidate.id === userId);
  if (!user) failNotFound("User");
  return user;
}

export function readUserExtrasForPeople(userId: string): MockUserExtras {
  const store = readPeopleMockStore();
  const existing = store.userExtras.get(userId);
  if (existing) return existing;
  const created: MockUserExtras = { bio: null, restriction: null, wallet: { balances: [], coinBalance: 0, pendingWithdrawalCount: 0 }, strikes: [], sessions: [], usernameHistory: [] };
  store.userExtras.set(userId, created);
  return created;
}

export type MutablePlatformUser = { -readonly [Key in keyof MockPlatformUserRecord]: MockPlatformUserRecord[Key] };

export function asMutablePlatformUser(user: MockPlatformUserRecord): MutablePlatformUser {
  return user as MutablePlatformUser;
}
