import { recordMockAuditEntry } from "@/mocks/mockAudit.mock";
import { requireMockPermission, requireMockStepUp } from "@/mocks/mockGuards.mock";
import { MockHttpError, readEnumValue, readIsoNow, readJsonObjectBody, readRequiredReason, respondWithJson } from "@/mocks/mockResponses.mock";
import { registerMockQueueCounter } from "@/mocks/mockQueueCounters.mock";
import { registerMockRoute, type MockRequest } from "@/mocks/mockRouter.mock";
import { readMockAreaStore } from "@/mocks/mockDatabase.mock";
import { buildDemoSecurityCases, type MockSecurityCaseRecord } from "@/mocks/seed/securityCasesSeed.mock";
import type { AdminPermission } from "@/constants/adminPermissions.constant";
import type { SecurityCaseAction, SecurityCaseDetail, SecurityCaseStatus, SecurityCaseSummary } from "@/types/securityCases.type";

import { applyModerationStateToPlatformUser, findPlatformUserRecordOrFail, findRecordByIdOrFail, presentModeratedUser } from "./trustStore.mock";

const actions: readonly SecurityCaseAction[] = ["clear", "keep_restricted", "suspend", "ban", "delete"];
const actionPermission: Record<SecurityCaseAction, AdminPermission> = { clear: "security:cases", keep_restricted: "users:restrict", suspend: "users:suspend", ban: "users:ban", delete: "users:delete" };
const actionStatus: Record<SecurityCaseAction, SecurityCaseStatus> = { clear: "cleared", keep_restricted: "kept_restricted", suspend: "suspended", ban: "banned", delete: "deleted" };
const pageSize = 25;

function readSecurityCases(): MockSecurityCaseRecord[] {
  return readMockAreaStore("trust:securityCases", buildDemoSecurityCases);
}

function countKind(record: MockSecurityCaseRecord, kind: string): number {
  return record.timeline.filter((item) => item.kind === kind).length;
}

function presentSummary(record: MockSecurityCaseRecord): SecurityCaseSummary {
  return {
    id: record.id, accountId: record.userId, account: presentModeratedUser(record.userId), trigger: record.trigger, status: record.status, severity: record.severity,
    violationCount: countKind(record, "access_violation"), failedChallengeCount: countKind(record, "challenge_failed"), passedChallengeCount: countKind(record, "challenge_passed"),
    autoSuspended: record.autoSuspended, openedAt: record.openedAt, lastActivityAt: record.timeline[0]?.at ?? record.openedAt, decidedAt: record.decidedAt, decision: record.decision,
  };
}

function presentDetail(record: MockSecurityCaseRecord): SecurityCaseDetail {
  const unique = (values: readonly string[]) => [...new Set(values.filter(Boolean))];
  return {
    ...presentSummary(record),
    state: { challengeRequired: record.trigger === "access_probing" && record.status === "open", suspectedBot: record.trigger === "suspected_bot" && record.status === "open", botScore: record.botScore, botReasons: record.botReasons, headlessReported: record.botReasons.includes("headless_client"), attestationVerdict: "", autoSuspendedAt: record.autoSuspended ? record.timeline[0]?.at ?? null : null },
    timeline: record.timeline,
    challengeHistory: record.timeline.filter((item) => item.kind.startsWith("challenge_")),
    linkedDevices: unique(record.timeline.map((item) => item.deviceId)),
    linkedIpPrefixes: unique(record.timeline.map((item) => item.ipPrefix)),
    previousCases: readSecurityCases().filter((other) => other.userId === record.userId && other.id !== record.id).length,
    automationNote: "Automation stops at a temporary suspension. Banning or deleting this account is a staff decision made here after reviewing the evidence.",
  };
}

function decide(request: MockRequest) {
  requireMockPermission(request, "security:cases");
  requireMockStepUp(request);
  const body = readJsonObjectBody(request);
  const action = readEnumValue(body, "action", actions);
  const principal = requireMockPermission(request, actionPermission[action]);
  const reason = readRequiredReason(body);
  const record = findRecordByIdOrFail(readSecurityCases(), request.params.caseId, "Security case");
  if (record.status !== "open") throw new MockHttpError(409, "CASE_ALREADY_DECIDED", "This case was already decided.");
  const user = findPlatformUserRecordOrFail(record.userId);
  if (action === "delete" && body.confirmUsername !== user.username) throw new MockHttpError(422, "VALIDATION_FAILED", "Type the account's username to confirm deletion.");
  const before = { status: record.status, userStatus: user.status };
  const decidedAt = readIsoNow();
  record.status = actionStatus[action];
  record.decidedAt = decidedAt;
  record.decision = { outcome: record.status, reason, decidedById: principal.adminId, decidedByName: principal.name, decidedAt, stepUp: true };
  if (action === "suspend") applyModerationStateToPlatformUser(record.userId, { status: "SUSPENDED" });
  if (action === "ban") applyModerationStateToPlatformUser(record.userId, { status: "BANNED" });
  if (action === "delete") applyModerationStateToPlatformUser(record.userId, { status: "DELETED" });
  recordMockAuditEntry(request, { action: `securityCase.${action}`, area: "moderation", target: { type: "securityCase", id: record.id, label: `@${user.username}` }, reason, before, after: { status: record.status, userStatus: findPlatformUserRecordOrFail(record.userId).status } });
  return respondWithJson(200, presentDetail(record));
}

export function registerSecurityCaseMockHandlers(): void {
  registerMockQueueCounter({
    key: "securityCases", label: "Security cases", href: "/moderation/security",
    readCount: () => {
      const open = readSecurityCases().filter((record) => record.status === "open");
      return { count: open.length, oldestAt: open.map((record) => record.openedAt).sort()[0] ?? null };
    },
  });
  registerMockRoute("GET", "/admin/security/cases", (request) => {
    requireMockPermission(request, "security:cases");
    const status = request.query.get("status") ?? "open";
    const trigger = request.query.get("trigger");
    const severity = request.query.get("severity");
    const offset = Math.max(Number(request.query.get("cursor") ?? 0) || 0, 0);
    const matching = readSecurityCases()
      .filter((record) => (status === "open" ? record.status === "open" : status === "decided" ? record.status !== "open" : true))
      .filter((record) => (!trigger || record.trigger === trigger) && (!severity || record.severity === severity))
      .sort((first, second) => Number(second.autoSuspended) - Number(first.autoSuspended) || second.openedAt.localeCompare(first.openedAt))
      .map(presentSummary);
    const items = matching.slice(offset, offset + pageSize);
    return respondWithJson(200, { items, page: 1, pageSize, total: matching.length, nextCursor: offset + pageSize < matching.length ? String(offset + pageSize) : null });
  });
  registerMockRoute("GET", "/admin/security/cases/:caseId", (request) => {
    requireMockPermission(request, "security:cases");
    return respondWithJson(200, presentDetail(findRecordByIdOrFail(readSecurityCases(), request.params.caseId, "Security case")));
  });
  registerMockRoute("POST", "/admin/security/cases/:caseId/decide", decide);
}
