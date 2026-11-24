import { doesAccessGrantPermission } from "@/config/rolePermissions.config";
import { isFeatureIncludedInPlan } from "@/config/planFeatures.config";
import { buildAnalyticsBreakdowns } from "@/mocks/handlers/analyticsBreakdownsBuilder.mock";
import { buildAnalyticsOverview, clampAnalyticsRangeToPlanHistory } from "@/mocks/handlers/analyticsOverviewBuilder.mock";
import { countDaysBetweenDateKeysInclusive, readSellerPlanForMockStore, readTodayDateKeyForStore, shiftDateKeyByDays } from "@/mocks/handlers/analyticsRecords.mock";
import { buildDashboardSummary } from "@/mocks/handlers/dashboardSummary.mock";
import { readMockDatabase } from "@/mocks/mockDatabase.mock";
import { requireMockStorePrincipal, respondWithJson, respondWithValidationFailure } from "@/mocks/mockResponses.mock";
import { registerMockRoute, type MockRequest } from "@/mocks/mockRouter.mock";

const dateKeyPattern = /^\d{4}-\d{2}-\d{2}$/;

function readAnalyticsRangeFromQuery(request: MockRequest): { fromKey: string; toKey: string } | { issues: { path: string; message: string }[] } {
  const todayKey = readTodayDateKeyForStore();
  const toKey = request.query.get("to") ?? todayKey;
  const fromKey = request.query.get("from") ?? shiftDateKeyByDays(toKey, -29);
  if (!dateKeyPattern.test(fromKey) || !dateKeyPattern.test(toKey) || fromKey > toKey) return { issues: [{ path: "from", message: "Pick a valid date range." }] };
  if (toKey > todayKey) return { issues: [{ path: "to", message: "The range cannot end in the future." }] };
  if (countDaysBetweenDateKeysInclusive(fromKey, toKey) > 731) return { issues: [{ path: "from", message: "Analytics cover at most two years at a time." }] };
  return { fromKey, toKey };
}

export function registerOverviewAndAnalyticsMockHandlers(): void {
  registerMockRoute("GET", "/seller/dashboard", (request) => {
    const principal = requireMockStorePrincipal(request);
    const locationParameter = request.query.get("locationId");
    const locationId = locationParameter && locationParameter !== "all" ? locationParameter : null;
    if (locationId && !readMockDatabase().locations.some((location) => location.id === locationId)) return respondWithValidationFailure([{ path: "locationId", message: "Choose one of your locations." }]);
    return respondWithJson(200, buildDashboardSummary(locationId, doesAccessGrantPermission({ role: principal.role, permissions: null }, "wallet:view")));
  });

  registerMockRoute("GET", "/seller/analytics/overview", (request) => {
    const principal = requireMockStorePrincipal(request);
    const range = readAnalyticsRangeFromQuery(request);
    if ("issues" in range) return respondWithValidationFailure(range.issues);
    const { fromKey, historyLimitedToDays } = clampAnalyticsRangeToPlanHistory(range.fromKey, range.toKey, readTodayDateKeyForStore(), readSellerPlanForMockStore(principal.storeId));
    return respondWithJson(200, buildAnalyticsOverview(range.fromKey, fromKey, range.toKey, historyLimitedToDays));
  });

  registerMockRoute("GET", "/analytics/seller/summary", (request) => {
    const principal = requireMockStorePrincipal(request);
    const window = request.query.get("window") || "30d";
    const multiplier = window === "7d" ? 0.25 : window === "90d" ? 2.4 : 1;
    const productViews = Math.round(9_400 * multiplier);
    const addToCarts = Math.round(1_280 * multiplier);
    const orders = Math.round(310 * multiplier);
    return respondWithJson(200, {
      storeId: principal.storeId,
      window,
      productViews,
      addToCarts,
      orders,
      grossSalesMinor: Math.round(2_480_000 * multiplier),
      conversionRate: Math.round((orders / productViews) * 10_000) / 100,
    });
  });

  registerMockRoute("GET", "/seller/analytics/breakdowns", (request) => {
    const principal = requireMockStorePrincipal(request);
    if (!isFeatureIncludedInPlan("advanced_analytics", readSellerPlanForMockStore(principal.storeId))) {
      return respondWithJson(402, { message: "Breakdowns by product, category, location and time are part of Pro.", code: "PLAN_FEATURE_REQUIRED", requiredPlan: "pro" });
    }
    const range = readAnalyticsRangeFromQuery(request);
    if ("issues" in range) return respondWithValidationFailure(range.issues);
    return respondWithJson(200, buildAnalyticsBreakdowns(range.fromKey, range.toKey));
  });
}
