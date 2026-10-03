import { convertAccessToSellerPlan, planLimitsByPlan } from "@/config/planFeatures.config";
import { readMockDatabase } from "@/mocks/mockDatabase.mock";
import { MockHttpError } from "@/mocks/mockResponses.mock";
import type { MockPrincipal } from "@/mocks/mockRouter.mock";
import type { PlanEntitlements } from "@/types/sellerAccess.type";

export function readPlanEntitlementsForStore(storeId: string): PlanEntitlements | null {
  const database = readMockDatabase();
  const gateStore = database.gateStores.find((store) => store.storeId === storeId);
  const subscriptionStatus = gateStore?.subscription.subscription?.status;
  if (!gateStore || (subscriptionStatus !== "active" && subscriptionStatus !== "trialing")) return null;
  return database.subscriptionPlans.find((plan) => plan.id === gateStore.subscription.planId)?.entitlements ?? null;
}

function readPlanLimitsForStore(storeId: string) {
  const gateStore = readMockDatabase().gateStores.find((store) => store.storeId === storeId);
  return planLimitsByPlan[convertAccessToSellerPlan({ subscription: gateStore?.subscription.subscription ?? null })];
}

export function countStaffSeatsInUse(): number {
  return readMockDatabase().staff.filter((staff) => staff.status !== "suspended" && staff.role !== "owner").length;
}

export function assertStaffSeatAvailable(storeId: string): void {
  const maximumSeats = readPlanLimitsForStore(storeId).maxStaffSeats;
  if (maximumSeats === 0) throw new MockHttpError(402, "PLAN_FEATURE_REQUIRED", "Team members are part of Pro. Upgrade to add people to your team.");
  if (countStaffSeatsInUse() >= maximumSeats) {
    throw new MockHttpError(409, "SEAT_LIMIT_REACHED", `Your plan includes ${maximumSeats} team seats and all are in use. Upgrade your plan or suspend someone first.`);
  }
}

export function assertLocationSlotAvailable(storeId: string): void {
  const maximumLocations = readPlanLimitsForStore(storeId).maxLocations;
  const activeLocations = readMockDatabase().locations.filter((location) => location.active).length;
  if (activeLocations >= maximumLocations) {
    throw new MockHttpError(409, "LOCATION_LIMIT_REACHED", `Your plan includes ${maximumLocations} ${maximumLocations === 1 ? "location" : "locations"} and all are in use. Upgrade your plan or deactivate a location first.`);
  }
}

export function describeMockActor(principal: MockPrincipal) {
  return { id: principal.staffId ?? principal.userId, name: principal.actorName, role: principal.role ?? "owner" } as const;
}
