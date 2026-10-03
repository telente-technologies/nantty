import type { StoreCreditBalance } from "@/types";

import { isoDateHoursAgo } from "./fixtures.mock";
import { convertUsdCentsToViewerCurrency } from "./locale.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";
import { storeRewardPercentBackBasisPoints, storeSummaryById } from "./storeDirectory.mock";
import { mockStoreCreditBalanceMinorByStore } from "./commerceFixtures.mock";

const buildStoreCreditBalances = (): StoreCreditBalance[] =>
  Object.entries(mockStoreCreditBalanceMinorByStore).map(([storeId, usdCents]) => {
    const store = storeSummaryById(storeId);
    return {
      storeId,
      storeName: store.name,
      logoUrl: store.logoUrl,
      balance: convertUsdCentsToViewerCurrency(usdCents),
      expiresAt: isoDateHoursAgo(-24 * 120),
      earnBackBasisPoints: storeRewardPercentBackBasisPoints[storeId] ?? null,
    };
  });

export const storeRewardsMocks: MockRoute[] = [createMockRoute("GET", "/api/v1/store-rewards/me", () => buildStoreCreditBalances())];
