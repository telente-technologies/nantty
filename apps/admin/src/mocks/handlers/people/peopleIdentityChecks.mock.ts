import { recordMockAuditEntry } from "@/mocks/mockAudit.mock";
import { requireMockPermission, requireMockStepUp } from "@/mocks/mockGuards.mock";
import { MockHttpError, failNotFound, readIsoNow, readIsoTimeOffset, readJsonObjectBody, readRequiredReason, respondWithJson } from "@/mocks/mockResponses.mock";
import { registerMockRoute, type MockRequest } from "@/mocks/mockRouter.mock";
import type { IdentityCase, IdentityCaseDecision, IdentityCaseDetail, IdentityCaseListItem } from "@/types/identityVerification.type";

type MockIdentityCase = { item: IdentityCaseListItem; detail: Omit<IdentityCaseDetail, "case"> };

const baseCase = (overrides: Partial<IdentityCaseListItem>): IdentityCaseListItem => ({
  id: "0192f3a0-0000-7000-8000-000000000001", profileId: "p1", accountId: "a1", color: "blue", planCode: "blue", paymentChannel: "web_paystack", status: "under_review",
  refundStatus: "not_applicable", refundMethod: "card", refundScope: "full", consentGiven: true, documentType: "NIN_SLIP", documentCountry: "NG",
  checks: { liveness: "passed", document: "passed", faceMatch: "passed", databaseLookup: "matched", faceMatchConfidence: 0.97, nameMatchScore: 0.62 },
  trustScore: 71, eligibleAtPayment: true, decisionReasons: ["name_does_not_match_profile"], fraudSignals: [], decisionReason: "", smileReference: "0000412233", smileResultCode: "0810",
  createdAt: readIsoTimeOffset(-180), decidedAt: null, verifiedAt: null, profileHandle: "amaka.styles", profileName: "Amaka Obi", ...overrides,
});

const health = { realFollowers: 4210, daysSinceLastViolation: 100000, fraudScore: 8, riskScore: 12, borderlineContent: false };

const identityCases: MockIdentityCase[] = [
  { item: baseCase({}), detail: { profile: { handle: "amaka.styles", displayName: "Amaka Obi", profileType: "personal", accountName: "Amaka Grace Obi", accountStatus: "active", joinedAt: "2025-03-14" }, health, eligibility: { state: "eligible", tier: "buy_now", trustScore: 82, reasons: [] } } },
  {
    item: baseCase({ id: "0192f3a0-0000-7000-8000-000000000002", accountId: "a2", profileHandle: "adire.lagos", profileName: "Adire Lagos Studio", color: "gold", planCode: "gold_only", paymentChannel: "web_paystack",
      checks: { liveness: "failed", document: "passed", faceMatch: "review", databaseLookup: "failed", faceMatchConfidence: 0.41, nameMatchScore: 0.2 }, trustScore: 44,
      decisionReasons: ["liveness_not_passed", "face_match_not_passed", "government_lookup_not_matched", "name_does_not_match_profile"], fraudSignals: ["spoof_attempt", "id_name_mismatch", "id_number_not_found"] }),
    detail: { profile: { handle: "adire.lagos", displayName: "Adire Lagos Studio", profileType: "business", accountName: "Tobi Adeyemi", accountStatus: "active", joinedAt: "2026-08-30" }, health: { ...health, realFollowers: 310, fraudScore: 46, riskScore: 38 }, eligibility: { state: "requested", tier: "request", trustScore: 44, reasons: ["account_age_below_threshold"] } },
  },
  { item: baseCase({ id: "0192f3a0-0000-7000-8000-000000000003", accountId: "a3", profileHandle: "kemi.codes", profileName: "Kemi Ade", paymentChannel: "apple_iap", status: "awaiting_capture", consentGiven: true,
      checks: { liveness: "pending", document: "pending", faceMatch: "pending", databaseLookup: "pending", faceMatchConfidence: 0, nameMatchScore: 0 }, decisionReasons: [], smileReference: "", smileResultCode: "" }),
    detail: { profile: { handle: "kemi.codes", displayName: "Kemi Ade", profileType: "personal", accountName: "Kemi Adebayo", accountStatus: "active", joinedAt: "2024-11-02" }, health, eligibility: { state: "eligible", tier: "buy_now", trustScore: 88, reasons: [] } } },
];

function findCaseOrFail(caseId: string | undefined): MockIdentityCase {
  const found = identityCases.find((candidate) => candidate.item.id === caseId);
  if (!found) failNotFound("Identity check");
  return found;
}

function decideCase(request: MockRequest, decision: IdentityCaseDecision) {
  requireMockPermission(request, "verification:review");
  requireMockStepUp(request);
  const found = findCaseOrFail(request.params.caseId);
  if (found.item.status === "approved" || found.item.status === "rejected") throw new MockHttpError(409, "ALREADY_DECIDED", "This verification has already been decided.");
  const reason = readRequiredReason(readJsonObjectBody(request));
  const refundable = found.item.planCode === "blue" || found.item.planCode === "gold_only";
  const now = readIsoNow();
  const before = found.item.status;
  found.item = { ...found.item, status: decision === "approve" ? "approved" : "rejected", decidedAt: now, decidedByName: request.principal?.name ?? "Admin", decisionReason: reason,
    verifiedAt: decision === "approve" ? now : null, refundStatus: decision === "reject" && refundable ? "requested" : found.item.refundStatus };
  recordMockAuditEntry(request, { action: `identityVerification.${decision}d`, area: "verification", target: { type: "verification_case", id: found.item.id, label: `@${found.item.profileHandle}` }, before: { status: before }, after: { status: found.item.status, refundStatus: found.item.refundStatus }, reason });
  const { profileHandle: _handle, profileName: _name, ...decided } = found.item;
  return respondWithJson(200, decided satisfies IdentityCase);
}

export function countIdentityCasesNeedingReview() {
  const waiting = identityCases.filter((candidate) => candidate.item.status === "under_review");
  return { count: waiting.length, oldestAt: waiting.map((candidate) => candidate.item.createdAt).sort()[0] ?? null };
}

export function registerPeopleIdentityCheckMockHandlers(): void {
  registerMockRoute("GET", "/admin/verification-cases", (request) => {
    requireMockPermission(request, "verification:review");
    const status = request.query.get("status") ?? "under_review";
    return respondWithJson(200, { data: identityCases.filter((candidate) => candidate.item.status === status).map((candidate) => candidate.item) });
  });
  registerMockRoute("GET", "/admin/verification-cases/:caseId", (request) => {
    requireMockPermission(request, "verification:review");
    const found = findCaseOrFail(request.params.caseId);
    return respondWithJson(200, { case: found.item, ...found.detail });
  });
  registerMockRoute("POST", "/admin/verification-cases/:caseId/approve", (request) => decideCase(request, "approve"));
  registerMockRoute("POST", "/admin/verification-cases/:caseId/reject", (request) => decideCase(request, "reject"));
}
