import { ApiError } from "@/errors/api.error";
import type { AccountHealth, ModerationDecision, Page } from "@/types";

import { createMockRoute, type MockRoute } from "./registry.mock";

const HOUR_IN_MS = 3_600_000;
const DAY_IN_MS = 24 * HOUR_IN_MS;
const appealedStrikeIds = new Set<string>();
const appealedDecisionIds = new Set<string>();
const counterNoticeClaimIds = new Set<string>();

function buildMockAccountHealth(): AccountHealth {
  const now = Date.now();
  const deadlineAt = new Date(now + 31 * HOUR_IN_MS).toISOString();
  return {
    accountId: "me", status: "AT_RISK", restrictions: [], canMonetise: true, canGoLive: true, needsSuspensionReview: false,
    activeStrikeCount: 1, copyrightStrikesInWindow: 1, pendingTakedownCount: 1, restrictionThreshold: 3, strikeWindowDays: 90, strikeLifetimeDays: 90, takedownDeadlineHours: 48,
    warnings: [{
      id: "warning-1", kind: "WARNING", policy: "Copyright takedown notice", reason: "The rights holder showed the original dance video and its upload records.", source: "COPYRIGHT",
      issuedAt: new Date(now - 17 * HOUR_IN_MS).toISOString(), expiresAt: new Date(now + 180 * DAY_IN_MS).toISOString(), status: "ACTIVE", appealStatus: "NONE", canAppeal: true, claimId: "claim-video-1", affectedContent: { type: "clip", id: "clip-1" },
    }],
    strikes: [{
      id: "strike-1", kind: "STRIKE", policy: "Copyright infringement", reason: "The content was not removed before the copyright takedown deadline", source: "COPYRIGHT",
      issuedAt: new Date(now - 20 * DAY_IN_MS).toISOString(), expiresAt: new Date(now + 70 * DAY_IN_MS).toISOString(), status: "ACTIVE",
      appealStatus: appealedStrikeIds.has("strike-1") ? "PENDING" : "NONE", canAppeal: !appealedStrikeIds.has("strike-1"), claimId: "claim-video-0", affectedContent: { type: "post", id: "post-9" },
    }],
    notices: [
      { claimId: "claim-video-1", remedy: "TAKEDOWN_WARNING", state: "AWAITING_REMOVAL", content: { type: "clip", id: "clip-1" }, workTitle: "Original “Buga” dance routine", claimantName: "Kaz Records",
        reason: "The rights holder showed the original dance video and its upload records.", decidedAt: new Date(now - 17 * HOUR_IN_MS).toISOString(), deadlineAt,
        canCounterNotice: !counterNoticeClaimIds.has("claim-video-1"), counterNoticeStatus: counterNoticeClaimIds.has("claim-video-1") ? "PENDING" : null },
      { claimId: "claim-audio-1", remedy: "AUDIO_MUTED", state: "MUTED", content: { type: "clip", id: "clip-2" }, workTitle: "“Lagos Nights” by DJ Kaz", claimantName: "Kaz Records",
        reason: "Registration and release records match the soundtrack.", decidedAt: new Date(now - 3 * DAY_IN_MS).toISOString(), deadlineAt: null,
        canCounterNotice: !counterNoticeClaimIds.has("claim-audio-1"), counterNoticeStatus: counterNoticeClaimIds.has("claim-audio-1") ? "PENDING" : null },
    ],
    helpLinks: [{ label: "Copyright and account status", href: "/help/safety-and-reporting/copyright-and-account-status" }],
    generatedAt: new Date(now).toISOString(),
  };
}

function buildMockModerationDecisions(): Page<ModerationDecision> {
  const decidedAt = new Date(Date.now() - 4 * DAY_IN_MS).toISOString();
  const hasAppeal = appealedDecisionIds.has("rep-mod-1");
  return {
    data: [
      {
        reportId: "rep-mod-1",
        action: "REMOVE_CONTENT",
        reason: "Removed under Community Guidelines: misleading product claim.",
        decidedAt,
        target: { type: "post", id: "post-4", label: "Post" },
        appealable: !hasAppeal,
        appeal: hasAppeal ? { id: "appeal-rep-mod-1", status: "PENDING" } : null,
      },
    ],
    nextCursor: null,
  };
}

export const accountHealthMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/account/status", () => buildMockAccountHealth()),
  createMockRoute("POST", "/api/v1/account/status/strikes/:strikeId/appeal", ({ params }) => {
    appealedStrikeIds.add(params.strikeId ?? "");
    return { status: "received" };
  }),
  createMockRoute("GET", "/api/v1/moderation/decisions/me", () => buildMockModerationDecisions()),
  createMockRoute("POST", "/api/v1/moderation/decisions/:reportId/appeal", ({ params, body }) => {
    const message = typeof (body as { message?: unknown } | null)?.message === "string" ? (body as { message: string }).message.trim() : "";
    if (message.length < 20) throw new ApiError(400, "Explain your appeal in 20 to 2000 characters");
    const reportId = params.reportId ?? "";
    if (appealedDecisionIds.has(reportId)) throw new ApiError(409, "You already appealed this decision.");
    appealedDecisionIds.add(reportId);
    return { status: "received", appealId: `appeal-${reportId}` };
  }),
  createMockRoute("POST", "/api/v1/copyright/claims/:claimId/counter-notices", ({ params }) => {
    counterNoticeClaimIds.add(params.claimId ?? "");
    return { noticeId: `notice-${params.claimId}`, status: "received", restoreEligibleAt: new Date(Date.now() + 14 * DAY_IN_MS).toISOString() };
  }),
  createMockRoute("GET", "/api/v1/users/me/suspension", () => ({
    reason: "Repeated copyright or policy violations.",
    suspendedAt: new Date(Date.now() - 2 * DAY_IN_MS).toISOString(),
    deletionScheduledFor: new Date(Date.now() + 28 * DAY_IN_MS).toISOString(),
    retentionDays: 30,
  })),
  createMockRoute("POST", "/api/v1/users/me/suspension/appeal", ({ body }) => {
    const message = typeof (body as { message?: unknown } | null)?.message === "string" ? (body as { message: string }).message.trim() : "";
    if (message.length < 20) throw new ApiError(400, "Explain your appeal in 20 to 2000 characters");
    return { status: "received", appealId: "susp_appeal_1" };
  }),
];
