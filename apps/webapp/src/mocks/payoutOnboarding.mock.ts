import type { PayoutOnboardingSummary } from "@/types/payoutOnboarding.type";

import { getSignedInMockUser } from "./fixtures.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";

const HOUR = 3_600_000;

export const payoutOnboardingMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/payments/payout-onboarding/me", (): PayoutOnboardingSummary => {
    const isSeller = Boolean(getSignedInMockUser().storeId);
    return {
      role: isSeller ? "seller" : "creator",
      status: "not_started",
      currentStep: "identity",
      completedSteps: [],
      accountStatus: null,
      pendingWithdrawable: null,
      withdrawalsEnabled: false,
      firstEarningsUnlockAt: isSeller ? new Date(Date.now() + 20 * HOUR).toISOString() : null,
    };
  }),
];
