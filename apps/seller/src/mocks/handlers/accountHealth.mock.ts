import { requireMockStorePrincipal, respondWithJson } from "@/mocks/mockResponses.mock";
import { registerMockRoute } from "@/mocks/mockRouter.mock";
import type { SellerAccountHealth } from "@/types/accountHealth.type";

const atRiskStores = new Set(["store_kelechi_kicks"]);

export function registerAccountHealthMockHandlers(): void {
  registerMockRoute("GET", "/account/status", (request) => {
    const { storeId } = requireMockStorePrincipal(request);
    const atRisk = atRiskStores.has(storeId);
    const health: SellerAccountHealth = {
      status: atRisk ? "AT_RISK" : "GOOD_STANDING", restrictions: [], canMonetise: true, canGoLive: true, activeStrikeCount: atRisk ? 1 : 0, restrictionThreshold: 3, pendingTakedownCount: atRisk ? 1 : 0, strikeLifetimeDays: 90,
    };
    return respondWithJson(200, health);
  });
}
