import { requireMockPermission, requireMockStepUp } from "@/mocks/mockGuards.mock";
import { recordMockAuditEntry } from "@/mocks/mockAudit.mock";
import { MockHttpError, readJsonObjectBody, readRequiredReason, respondWithJson } from "@/mocks/mockResponses.mock";
import { registerMockRoute } from "@/mocks/mockRouter.mock";
import type { MockCopyrightClaimRecord } from "@/mocks/seed/trustCopyright.mock";
import type { AccountHealthStrike, AccountHealthSummary } from "@/types/accountHealth.type";
import type { CopyrightPolicySettings, CopyrightRemedy } from "@/types/copyright.type";

import { readEffectiveStrikeCount, readTrustStore } from "./trustStore.mock";

const holder = globalThis as typeof globalThis & { __nanttyAdminCopyrightPolicy?: CopyrightPolicySettings; __nanttyAdminStrikeAppeals?: Map<string, AccountHealthStrike["appealStatus"]> };
const defaultPolicy: CopyrightPolicySettings = { takedownDeadlineHours: 48, strikeLifetimeDays: 365, warningLifetimeDays: 365, strikeWindowDays: 365, restrictionThreshold: 2, suspensionReviewThreshold: 3, restrictionDays: 30 };
const ranges: Record<keyof Omit<CopyrightPolicySettings, "updatedBy" | "updatedAt">, readonly [number, number]> = {
  takedownDeadlineHours: [1, 720], strikeLifetimeDays: [7, 730], warningLifetimeDays: [7, 730], strikeWindowDays: [7, 730], restrictionThreshold: [1, 2], suspensionReviewThreshold: [1, 20], restrictionDays: [30, 90],
};

export const readMockCopyrightPolicy = (): CopyrightPolicySettings => (holder.__nanttyAdminCopyrightPolicy ??= { ...defaultPolicy });
const appeals = () => (holder.__nanttyAdminStrikeAppeals ??= new Map([["str_usr_0025_1", "PENDING"]]));

export function applyMockUpheldRemedy(record: MockCopyrightClaimRecord): { readonly remedy: CopyrightRemedy; readonly issuesStrike: boolean } {
  const scope = record.claimScope ?? (record.workType === "SOUND" ? "AUDIO" : "VIDEO");
  const remedy: CopyrightRemedy = record.target.type === "LIVE" ? "TAKEN_DOWN" : scope === "AUDIO" ? "AUDIO_MUTED" : "TAKEDOWN_WARNING";
  record.claimScope = scope;
  record.remedy = remedy;
  if (remedy === "AUDIO_MUTED") {
    record.targetFlag = "MUTED";
    record.remedyState = "MUTED";
  } else if (remedy === "TAKEDOWN_WARNING") {
    record.targetFlag = "WARNED";
    record.remedyState = "AWAITING_REMOVAL";
    record.takedownDeadlineAt = new Date(Date.now() + readMockCopyrightPolicy().takedownDeadlineHours * 3_600_000).toISOString();
  } else {
    record.targetFlag = "TAKEN_DOWN";
    record.remedyState = "TAKEN_DOWN";
    record.target = { ...record.target, visibility: "REMOVED" };
  }
  return { remedy, issuesStrike: remedy === "TAKEN_DOWN" };
}

function presentAccountHealth(userId: string): AccountHealthSummary {
  const policy = readMockCopyrightPolicy();
  const claims = readTrustStore().copyrightClaims.filter((claim) => claim.infringerUserId === userId && (claim.status === "UPHELD" || claim.status === "COUNTER_NOTICE" || (claim.remedy ?? "NONE") !== "NONE"));
  const strikeCount = readEffectiveStrikeCount(userId);
  const strikes: AccountHealthStrike[] = Array.from({ length: strikeCount }, (_, index) => ({
    id: `str_${userId}_${index + 1}`, kind: "STRIKE", policy: "Copyright infringement", reason: "Content was not removed before the copyright takedown deadline", source: "COPYRIGHT",
    issuedAt: new Date(Date.now() - (index + 1) * 9 * 86_400_000).toISOString(), expiresAt: new Date(Date.now() + (policy.strikeLifetimeDays - (index + 1) * 9) * 86_400_000).toISOString(),
    appealStatus: appeals().get(`str_${userId}_${index + 1}`) ?? "NONE", claimId: null, affectedContent: null,
  }));
  const pending = claims.filter((claim) => claim.remedyState === "AWAITING_REMOVAL").length;
  const restricted = strikeCount >= policy.restrictionThreshold;
  return {
    accountId: userId, status: restricted ? "RESTRICTED" : strikeCount > 0 || pending > 0 ? "AT_RISK" : "GOOD_STANDING", restrictions: restricted ? ["MONETISATION", "GOING_LIVE"] : [], canMonetise: !restricted, canGoLive: !restricted,
    needsSuspensionReview: strikeCount >= policy.suspensionReviewThreshold, activeStrikeCount: strikeCount, copyrightStrikesInWindow: strikeCount, pendingTakedownCount: pending, restrictionThreshold: policy.restrictionThreshold,
    strikeWindowDays: policy.strikeWindowDays, warnings: [], strikes,
    notices: claims.map((claim) => ({ claimId: claim.id, remedy: claim.remedy ?? "TAKEN_DOWN", state: claim.remedyState ?? "TAKEN_DOWN", content: { type: claim.target.type.toLowerCase(), id: claim.target.id }, workTitle: claim.workTitle, deadlineAt: claim.takedownDeadlineAt ?? null, counterNoticeStatus: claim.counterNotices[0]?.status ?? null })),
  };
}

export function registerCopyrightRemedyMockHandlers(): void {
  registerMockRoute("GET", "/admin/copyright-policy", (request) => {
    requireMockPermission(request, "copyright:review");
    return respondWithJson(200, readMockCopyrightPolicy());
  });

  registerMockRoute("PUT", "/admin/copyright-policy", (request) => {
    requireMockPermission(request, "copyright:review");
    requireMockStepUp(request);
    const body = readJsonObjectBody(request);
    const reason = readRequiredReason(body);
    const before = readMockCopyrightPolicy();
    const next = { ...before } as Record<string, number | string | undefined>;
    for (const [field, [lowest, highest]] of Object.entries(ranges)) {
      const value = Number(body[field]);
      if (!Number.isInteger(value) || value < lowest || value > highest) throw new MockHttpError(400, "VALIDATION_FAILED", `${field} must be between ${lowest} and ${highest}`);
      next[field] = value;
    }
    holder.__nanttyAdminCopyrightPolicy = { ...(next as unknown as CopyrightPolicySettings), updatedBy: request.principal?.name ?? "Admin", updatedAt: new Date().toISOString() };
    recordMockAuditEntry(request, { action: "copyright.policy_updated", area: "copyright", target: { type: "copyrightPolicy", id: "default", label: "Copyright policy" }, reason, before, after: holder.__nanttyAdminCopyrightPolicy });
    return respondWithJson(200, holder.__nanttyAdminCopyrightPolicy);
  });

  registerMockRoute("GET", "/admin/account-health/:userId", (request) => {
    requireMockPermission(request, "users:read", "copyright:review");
    return respondWithJson(200, presentAccountHealth(request.params.userId ?? ""));
  });

  for (const decision of ["uphold", "overturn"] as const) {
    registerMockRoute("POST", `/admin/strike-appeals/:strikeId/${decision}`, (request) => {
      requireMockPermission(request, "moderation:appeals", "copyright:review");
      const reason = readRequiredReason(readJsonObjectBody(request));
      const strikeId = request.params.strikeId ?? "";
      if (appeals().get(strikeId) !== "PENDING") throw new MockHttpError(409, "APPEAL_NOT_PENDING", "This strike has no pending appeal.");
      appeals().set(strikeId, decision === "uphold" ? "UPHELD" : "OVERTURNED");
      recordMockAuditEntry(request, { action: `strike.appeal_${decision === "uphold" ? "upheld" : "overturned"}`, area: "copyright", target: { type: "strike", id: strikeId, label: strikeId }, reason, before: { appealStatus: "PENDING" }, after: { appealStatus: appeals().get(strikeId) } });
      return respondWithJson(200, { status: decision });
    });
  }
}
