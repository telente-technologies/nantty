import { readMockDatabase } from "@/mocks/mockDatabase.mock";
import type { MockStoreMembership } from "@/mocks/seed/demoPeople.mock";

export function findMockMembershipForUserAndStore(userId: string, requestedStoreId: string | null): MockStoreMembership | undefined {
  const memberships = readMockDatabase().memberships.filter((candidate) => candidate.userId === userId);
  return memberships.find((candidate) => candidate.storeId === requestedStoreId) ?? memberships[0];
}
