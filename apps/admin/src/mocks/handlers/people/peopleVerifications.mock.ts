import type { AdminPermission } from "@/constants/adminPermissions.constant";
import { listMockAuditEntriesForTarget, recordMockAuditEntry } from "@/mocks/mockAudit.mock";
import { requireMockPermission, requireMockStepUp } from "@/mocks/mockGuards.mock";
import { MockHttpError, failNotFound, matchesSearchText, paginateByCursor, readIsoNow, readIsoTimeOffset, readJsonObjectBody, readRequiredReason, respondWithJson } from "@/mocks/mockResponses.mock";
import { registerMockRoute, type MockRequest } from "@/mocks/mockRouter.mock";
import { presentPlatformUserSummary } from "@/mocks/seed/demoPlatformUsers.mock";
import { readDemoVerificationPlanPrice, type MockVerificationRecord } from "@/mocks/seed/peopleVerifications.mock";
import type { VerificationStatus } from "@/types/platformUser.type";
import type { VerificationApplication, VerificationApplicationDetail, VerificationTransition } from "@/types/verification.type";

import { applyVerificationRecordToPlatformUser, asMutablePlatformUser, findPlatformUserForPeopleOrFail, readPeopleMockStore } from "./peopleStore.mock";

const transitionsByStatus: Record<VerificationStatus, readonly VerificationTransition[]> = {
  PENDING: ["approve", "reject"],
  VERIFIED: ["suspend", "revoke"],
  SUSPENDED: ["reinstate", "revoke"],
  REVOKED: [],
  UNVERIFIED: [],
};

const transitionRules: Record<VerificationTransition, { readonly nextStatus: VerificationStatus; readonly permission: AdminPermission; readonly needsStepUp: boolean; readonly action: string }> = {
  approve: { nextStatus: "VERIFIED", permission: "verification:review", needsStepUp: false, action: "verification.approved" },
  reject: { nextStatus: "UNVERIFIED", permission: "verification:review", needsStepUp: false, action: "verification.rejected" },
  suspend: { nextStatus: "SUSPENDED", permission: "verification:revoke", needsStepUp: true, action: "verification.suspended" },
  revoke: { nextStatus: "REVOKED", permission: "verification:revoke", needsStepUp: true, action: "verification.revoked" },
  reinstate: { nextStatus: "VERIFIED", permission: "verification:review", needsStepUp: false, action: "verification.reinstated" },
};

export function presentVerificationApplication(record: MockVerificationRecord): VerificationApplication {
  const user = findPlatformUserForPeopleOrFail(record.userId);
  return {
    id: record.id,
    user: presentPlatformUserSummary(user),
    color: record.color,
    tier: record.tier,
    status: record.status,
    subjectKind: record.subjectKind,
    submittedAt: record.submittedAt,
    reviewedAt: record.reviewedAt,
    reviewedByName: record.reviewedByName,
    decisionReason: record.decisionReason,
    badgeVisibleWhenVerified: record.tier !== "ESSENTIAL",
    grantsDashboardAccess: record.color === "GOLD",
    subscription: record.color === "BLACK" ? null : readDemoVerificationPlanPrice(record.color, record.tier, user.currency),
    applicant: record.applicant,
    documents: record.documents,
    checks: record.checks,
    allowedTransitions: transitionsByStatus[record.status],
  };
}

function findVerificationRecordOrFail(verificationId: string | undefined): MockVerificationRecord {
  const record = readPeopleMockStore().verifications.find((candidate) => candidate.id === verificationId);
  if (!record) failNotFound("Verification request");
  return record;
}

function presentVerificationDetail(record: MockVerificationRecord): VerificationApplicationDetail {
  return { ...presentVerificationApplication(record), history: listMockAuditEntriesForTarget("verification", record.id) };
}

function performVerificationTransition(request: MockRequest, transition: VerificationTransition) {
  const rule = transitionRules[transition];
  const principal = requireMockPermission(request, rule.permission);
  if (rule.needsStepUp) requireMockStepUp(request);
  const record = findVerificationRecordOrFail(request.params.verificationId);
  const reason = readRequiredReason(readJsonObjectBody(request));
  if (!transitionsByStatus[record.status].includes(transition)) throw new MockHttpError(409, "INVALID_TRANSITION", `This verification is ${record.status.toLowerCase()}, so “${transition}” is not allowed.`);
  const user = findPlatformUserForPeopleOrFail(record.userId);
  const before = { status: record.status, color: record.color, tier: record.tier, badgeVisible: user.verification?.badgeVisible ?? false, dashboardAccess: record.color === "GOLD" && record.status === "VERIFIED" };
  record.status = rule.nextStatus;
  record.reviewedAt = readIsoNow();
  record.reviewedByName = principal.name;
  record.decisionReason = reason;
  applyVerificationRecordToPlatformUser(record);
  if (record.color === "GOLD" && rule.nextStatus === "VERIFIED") asMutablePlatformUser(user).isSeller = true;
  const after = { status: record.status, color: record.color, tier: record.tier, badgeVisible: user.verification?.badgeVisible ?? false, dashboardAccess: record.color === "GOLD" && record.status === "VERIFIED" };
  recordMockAuditEntry(request, { action: rule.action, area: "verification", target: { type: "verification", id: record.id, label: `@${user.username}` }, reason, before, after });
  return respondWithJson(200, presentVerificationDetail(record));
}

export function countPendingVerifications(): { count: number; oldestAt: string | null; breachingSla: number } {
  const pending = readPeopleMockStore().verifications.filter((record) => record.status === "PENDING");
  const oldest = pending.map((record) => record.submittedAt).sort()[0] ?? null;
  const breachingSla = pending.filter((record) => Date.now() - Date.parse(record.submittedAt) > 72 * 3_600_000).length;
  return { count: pending.length, oldestAt: oldest, breachingSla };
}

export function registerPeopleVerificationMockHandlers(): void {
  registerMockRoute("GET", "/admin/verifications", (request) => {
    requireMockPermission(request, "verification:review", "verification:revoke");
    const status = request.query.get("status");
    const color = request.query.get("color");
    const search = request.query.get("search");
    const records = readPeopleMockStore()
      .verifications.filter((record) => (!status || status === "ALL" || record.status === status) && (!color || record.color === color))
      .map(presentVerificationApplication)
      .filter((application) => matchesSearchText(search, application.user.username, application.user.displayName, application.applicant.legalName, application.applicant.businessName, application.id))
      .sort((first, second) => (first.status === "PENDING" ? 0 : 1) - (second.status === "PENDING" ? 0 : 1) || first.submittedAt.localeCompare(second.submittedAt));
    return respondWithJson(200, paginateByCursor(records, request));
  });

  registerMockRoute("GET", "/admin/verifications/:verificationId", (request) => {
    requireMockPermission(request, "verification:review", "verification:revoke");
    return respondWithJson(200, presentVerificationDetail(findVerificationRecordOrFail(request.params.verificationId)));
  });

  registerMockRoute("GET", "/admin/verifications/:verificationId/documents/:documentId", (request) => {
    const principal = requireMockPermission(request, "verification:documents");
    const record = findVerificationRecordOrFail(request.params.verificationId);
    const document = record.documents.find((candidate) => candidate.id === request.params.documentId);
    if (!document) failNotFound("Document");
    const openedAt = readIsoNow();
    recordMockAuditEntry(request, { action: "verification.document_viewed", area: "verification", target: { type: "verification", id: record.id, label: document.label }, after: { documentId: document.id, kind: document.kind } });
    return respondWithJson(200, { documentId: document.id, kind: document.kind, label: document.label, viewUrl: `mock-private-media://verification/${record.id}/${document.id}?expires=120`, expiresAt: readIsoTimeOffset(2), watermarkText: `Nantty Admin — confidential · ${principal.email} · ${openedAt}` });
  });

  for (const transition of Object.keys(transitionRules) as VerificationTransition[]) {
    registerMockRoute("POST", `/admin/verifications/:verificationId/${transition}`, (request) => performVerificationTransition(request, transition));
  }
}
