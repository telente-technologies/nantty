import { createMockRoute, type MockRoute } from "@/mocks/registry.mock";
import type { AccountHealthSummary } from "@/types/accountHealth.type";

const daysFromNow = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

export const accountHealthMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/account/status", (): AccountHealthSummary => ({
    status: "AT_RISK", restrictions: [], canMonetise: true, canGoLive: true, activeStrikeCount: 1, copyrightStrikesInWindow: 1, restrictionThreshold: 3, suspensionReviewThreshold: 5,
    strikeWindowDays: 90, pendingTakedownCount: 1, strikeLifetimeDays: 90, warnings: [],
    strikes: [{ id: "strike_1", kind: "copyright", policy: "copyright", reason: "Music used without a licence in a clip.", source: "copyright_claim", issuedAt: daysFromNow(-12), expiresAt: daysFromNow(78), status: "active", appealStatus: "none", canAppeal: true, claimId: "claim-video-1" }],
    notices: [{ claimId: "claim-video-1", remedy: "removal", state: "AWAITING_REMOVAL", workTitle: "Sunset Groove (instrumental)", deadlineAt: new Date(Date.now() + 31 * 3_600_000).toISOString(), canCounterNotice: true }],
  })),
];
