import { readMockDatabase } from "@/mocks/mockDatabase.mock";
import type { MockStoreMembership } from "@/mocks/seed/demoPeople.mock";
import type { GoldTier, SubscriptionPlanTier } from "@/types/sellerAccess.type";

export function findMockMembershipForUserAndStore(userId: string, requestedStoreId: string | null): MockStoreMembership | undefined {
  const memberships = readMockDatabase().memberships.filter((candidate) => candidate.userId === userId);
  return requestedStoreId ? memberships.find((candidate) => candidate.storeId === requestedStoreId) : memberships[0];
}

export function convertSubscriptionPlanToGoldBadgeTier(plan: SubscriptionPlanTier | null | undefined): GoldTier | null {
  if (!plan) return null;
  return plan === "BUSINESS" ? "PREMIUM" : "PRO";
}
