import { readMockDatabase } from "@/mocks/mockDatabase.mock";
import { MockHttpError } from "@/mocks/mockResponses.mock";
import type { MockPrincipal } from "@/mocks/mockRouter.mock";
import type { GoldEntitlements } from "@/types/sellerAccess.type";

export function readGoldEntitlementsForStore(storeId: string): GoldEntitlements | null {
  const database = readMockDatabase();
  const gateStore = database.gateStores.find((store) => store.storeId === storeId);
  const subscriptionStatus = gateStore?.subscription.subscription?.status;
  if (!gateStore || (subscriptionStatus !== "active" && subscriptionStatus !== "trialing")) return null;
  return database.subscriptionPlans.find((plan) => plan.id === gateStore.subscription.planId)?.entitlements ?? null;
}

export function countStaffSeatsInUse(): number {
  return readMockDatabase().staff.filter((staff) => staff.status !== "suspended").length;
}

export function assertStaffSeatAvailable(storeId: string): void {
  const entitlements = readGoldEntitlementsForStore(storeId);
  const maximumSeats = entitlements ? entitlements.maxStaffSeats : 0;
  if (maximumSeats !== null && countStaffSeatsInUse() >= maximumSeats) {
    throw new MockHttpError(409, "SEAT_LIMIT_REACHED", `Your Gold plan includes ${maximumSeats} staff seats and all are in use. Upgrade your plan or suspend someone first.`);
  }
}

export function assertLocationSlotAvailable(storeId: string): void {
  const entitlements = readGoldEntitlementsForStore(storeId);
  const maximumLocations = entitlements ? entitlements.maxLocations : 0;
  const activeLocations = readMockDatabase().locations.filter((location) => location.active).length;
  if (maximumLocations !== null && activeLocations >= maximumLocations) {
    throw new MockHttpError(409, "LOCATION_LIMIT_REACHED", `Your Gold plan includes ${maximumLocations} locations and all are in use. Upgrade your plan or deactivate a location first.`);
  }
}

export function describeMockActor(principal: MockPrincipal) {
  return { id: principal.staffId ?? principal.userId, name: principal.actorName, role: principal.role ?? "owner" } as const;
}
