import { createMockRoute, type MockRoute } from "@/mocks/registry.mock";
import type { AccountHealthSummary } from "@/types/accountHealth.type";

export const accountHealthMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/account/status", (): AccountHealthSummary => ({
    status: "AT_RISK", restrictions: [], canMonetise: true, canGoLive: true, activeStrikeCount: 1, restrictionThreshold: 3, pendingTakedownCount: 1, strikeLifetimeDays: 90, warnings: [],
    notices: [{ claimId: "claim-video-1", state: "AWAITING_REMOVAL", deadlineAt: new Date(Date.now() + 31 * 3_600_000).toISOString() }],
  })),
];
