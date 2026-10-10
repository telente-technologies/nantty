import { listMockAuditEntriesForTarget, recordMockAuditEntry } from "@/mocks/mockAudit.mock";
import { requireMockPermission, requireMockStepUp } from "@/mocks/mockGuards.mock";
import { MockHttpError, matchesSearchText, paginateByCursor, readEnumValue, readJsonObjectBody, readRequiredReason, readIsoNow, respondWithJson } from "@/mocks/mockResponses.mock";
import { registerMockQueueCounter } from "@/mocks/mockQueueCounters.mock";
import { registerMockRoute, type MockRequest } from "@/mocks/mockRouter.mock";
import { readMockAreaStore } from "@/mocks/mockDatabase.mock";
import { buildDemoSuspensionCases, type MockSuspensionCaseRecord } from "@/mocks/seed/suspensionsSeed.mock";
import type { SuspendedAccount, SuspensionCaseDetail, SuspensionCaseSummary, SuspensionReasonCode } from "@/types/suspensions.type";

import { applyModerationStateToPlatformUser, findPlatformUserRecordOrFail, findRecordByIdOrFail, presentModeratedUser } from "./trustStore.mock";

const reasonCodes: readonly SuspensionReasonCode[] = ["FRAUD", "SCAM", "COUNTERFEIT", "HARASSMENT", "IMPERSONATION", "SPAM_NETWORK", "OTHER"];
const deletionWindowDays = 120;
const dayMs = 86_400_000;

function readSuspensionCases(): MockSuspensionCaseRecord[] {
  return readMockAreaStore("trust:suspensions", () => {
    const cases = buildDemoSuspensionCases();
    cases.filter((record) => record.suspension).forEach((record) => applyModerationStateToPlatformUser(record.userId, { status: "SUSPENDED" }));
    return cases;
  });
}

function presentSummary(record: MockSuspensionCaseRecord): SuspensionCaseSummary {
  return {
    id: record.id,
    user: presentModeratedUser(record.userId),
    source: record.source,
    status: record.status,
    riskScore: record.riskScore,
    topSignals: [...record.signals].sort((first, second) => second.weight - first.weight).slice(0, 2).map((signal) => signal.label),
    reportCount: record.reports.length,
    createdAt: record.createdAt,
  };
}

function presentDetail(record: MockSuspensionCaseRecord): SuspensionCaseDetail {
  return { ...presentSummary(record), signals: record.signals, evidence: record.evidence, reports: record.reports, modelVersion: record.modelVersion ?? "risk-suggester-2026.09", decision: record.decision, history: listMockAuditEntriesForTarget("suspensionCase", record.id) };
}

function presentSuspendedAccount(record: MockSuspensionCaseRecord): SuspendedAccount {
  const suspension = record.suspension;
  if (!suspension) throw new MockHttpError(409, "NOT_SUSPENDED", "This account is not suspended.");
  const deletionDueAt = new Date(Date.parse(suspension.suspendedAt) + deletionWindowDays * dayMs).toISOString();
  return {
    caseId: record.id,
    user: presentModeratedUser(record.userId),
    reasonCode: suspension.reasonCode,
    note: record.decision?.reason ?? "",
    suspendedAt: suspension.suspendedAt,
    suspendedByName: suspension.suspendedByName,
    deletionDueAt,
    daysUntilDeletion: Math.max(0, Math.ceil((Date.parse(deletionDueAt) - Date.now()) / dayMs)),
    appeal: record.appeal,
  };
}

function isActiveSuspension(record: MockSuspensionCaseRecord): boolean {
  return record.status === "SUSPENDED" && record.suspension !== null && !record.isReinstated;
}

function readOpenCaseOrFail(request: MockRequest): MockSuspensionCaseRecord {
  const record = findRecordByIdOrFail(readSuspensionCases(), request.params.caseId, "Suspension case");
  if (record.status !== "PENDING" && record.status !== "ESCALATED") throw new MockHttpError(409, "CASE_ALREADY_DECIDED", "Someone already decided this case. Reload to see the outcome.");
  return record;
}

function authorizeAction(request: MockRequest) {
  const principal = requireMockPermission(request, "users:suspend");
  requireMockStepUp(request);
  return principal;
}

function auditCase(request: MockRequest, record: MockSuspensionCaseRecord, action: string, reason: string, before: unknown, after: unknown) {
  recordMockAuditEntry(request, { action: `suspension.${action}`, area: "moderation", target: { type: "suspensionCase", id: record.id, label: `@${findPlatformUserRecordOrFail(record.userId).username}` }, reason, before, after });
}

function decideCase(request: MockRequest, outcome: "SUSPENDED" | "DISMISSED" | "ESCALATED") {
  const principal = authorizeAction(request);
  const body = readJsonObjectBody(request);
  const reason = readRequiredReason(body);
  const reasonCode = outcome === "SUSPENDED" ? readEnumValue(body, "reasonCode", reasonCodes) : null;
  const record = readOpenCaseOrFail(request);
  const user = findPlatformUserRecordOrFail(record.userId);
  const before = { caseStatus: record.status, userStatus: user.status };
  const decidedAt = readIsoNow();
  record.decision = { outcome, reasonCode, reason, decidedByName: principal.name, decidedAt };
  if (outcome === "SUSPENDED" && reasonCode) {
    record.status = "SUSPENDED";
    record.suspension = { reasonCode, suspendedAt: decidedAt, suspendedByName: principal.name };
    applyModerationStateToPlatformUser(record.userId, { status: "SUSPENDED" });
  } else {
    record.status = outcome === "DISMISSED" ? "DISMISSED" : "ESCALATED";
  }
  auditCase(request, record, outcome === "SUSPENDED" ? "approved" : outcome.toLowerCase(), reason, before, { caseStatus: record.status, userStatus: findPlatformUserRecordOrFail(record.userId).status, reasonCode, deletionDueInDays: outcome === "SUSPENDED" ? deletionWindowDays : null });
  return respondWithJson(200, presentDetail(record));
}

function findActiveSuspensionOrFail(request: MockRequest): MockSuspensionCaseRecord {
  const record = findRecordByIdOrFail(readSuspensionCases(), request.params.caseId, "Suspended account");
  if (!isActiveSuspension(record)) throw new MockHttpError(409, "NOT_SUSPENDED", "This account is no longer suspended.");
  return record;
}

export function registerSuspensionMockHandlers(): void {
  registerMockQueueCounter({
    key: "suspensions", label: "Suspension queue", href: "/moderation/suspensions",
    readCount: () => {
      const open = readSuspensionCases().filter((record) => record.status === "PENDING" || record.status === "ESCALATED");
      return { count: open.length, oldestAt: open.map((record) => record.createdAt).sort()[0] ?? null };
    },
  });

  registerMockRoute("GET", "/admin/suspensions/cases", (request) => {
    requireMockPermission(request, "users:suspend");
    const status = request.query.get("status") ?? "OPEN";
    const source = request.query.get("source");
    const modelVersion = request.query.get("modelVersion");
    const search = request.query.get("search");
    const items = readSuspensionCases()
      .filter((record) => (status === "OPEN" ? record.status === "PENDING" || record.status === "ESCALATED" : status === "DECIDED" ? record.status === "SUSPENDED" || record.status === "DISMISSED" : status === "ALL" || record.status === status))
      .filter((record) => !modelVersion || record.modelVersion === modelVersion)
      .filter((record) => (!source || record.source === source) && matchesSearchText(search, record.id, findPlatformUserRecordOrFail(record.userId).username, findPlatformUserRecordOrFail(record.userId).displayName))
      .sort((first, second) => second.riskScore - first.riskScore)
      .map(presentSummary);
    return respondWithJson(200, paginateByCursor(items, request));
  });

  registerMockRoute("GET", "/admin/suspensions/cases/:caseId", (request) => {
    requireMockPermission(request, "users:suspend");
    return respondWithJson(200, presentDetail(findRecordByIdOrFail(readSuspensionCases(), request.params.caseId, "Suspension case")));
  });

  registerMockRoute("POST", "/admin/suspensions/cases/:caseId/approve", (request) => decideCase(request, "SUSPENDED"));
  registerMockRoute("POST", "/admin/suspensions/cases/:caseId/dismiss", (request) => decideCase(request, "DISMISSED"));
  registerMockRoute("POST", "/admin/suspensions/cases/:caseId/escalate", (request) => decideCase(request, "ESCALATED"));

  registerMockRoute("GET", "/admin/suspensions/accounts", (request) => {
    requireMockPermission(request, "users:suspend");
    const appeal = request.query.get("appeal");
    const search = request.query.get("search");
    const items = readSuspensionCases()
      .filter(isActiveSuspension)
      .filter((record) => (appeal === "PENDING" ? record.appeal?.status === "PENDING" : true))
      .filter((record) => matchesSearchText(search, findPlatformUserRecordOrFail(record.userId).username, findPlatformUserRecordOrFail(record.userId).displayName))
      .map(presentSuspendedAccount)
      .sort((first, second) => first.daysUntilDeletion - second.daysUntilDeletion);
    return respondWithJson(200, paginateByCursor(items, request));
  });

  registerMockRoute("POST", "/admin/suspensions/accounts/:caseId/reinstate", (request) => {
    authorizeAction(request);
    const reason = readRequiredReason(readJsonObjectBody(request));
    const record = findActiveSuspensionOrFail(request);
    record.isReinstated = true;
    if (record.appeal?.status === "PENDING") record.appeal = { ...record.appeal, status: "OVERTURNED", decisionNote: reason };
    applyModerationStateToPlatformUser(record.userId, { status: "ACTIVE" });
    auditCase(request, record, "reinstated", reason, { userStatus: "SUSPENDED", deletionClockRunning: true }, { userStatus: "ACTIVE", deletionClockRunning: false });
    return respondWithJson(200, { reinstated: true });
  });

  registerMockRoute("POST", "/admin/suspensions/accounts/:caseId/appeal/decide", (request) => {
    authorizeAction(request);
    const body = readJsonObjectBody(request);
    const outcome = readEnumValue(body, "outcome", ["UPHELD", "OVERTURNED"] as const);
    const reason = readRequiredReason(body);
    const record = findActiveSuspensionOrFail(request);
    if (record.appeal?.status !== "PENDING") throw new MockHttpError(409, "NO_PENDING_APPEAL", "There is no pending appeal on this account.");
    record.appeal = { ...record.appeal, status: outcome, decisionNote: reason };
    if (outcome === "OVERTURNED") {
      record.isReinstated = true;
      applyModerationStateToPlatformUser(record.userId, { status: "ACTIVE" });
    }
    auditCase(request, record, `appeal_${outcome.toLowerCase()}`, reason, { appealStatus: "PENDING" }, { appealStatus: outcome, userStatus: findPlatformUserRecordOrFail(record.userId).status });
    return respondWithJson(200, { outcome });
  });
}
