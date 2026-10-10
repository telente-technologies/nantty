import { listMockAuditEntriesForTarget, recordMockAuditEntry } from "@/mocks/mockAudit.mock";
import { requireMockPermission } from "@/mocks/mockGuards.mock";
import { MockHttpError, matchesSearchText, paginateByCursor, readEnumValue, readJsonObjectBody, readRequiredReason, respondWithJson } from "@/mocks/mockResponses.mock";
import { registerMockRoute } from "@/mocks/mockRouter.mock";
import type { MockAppealRecord } from "@/mocks/seed/trustAppeals.mock";
import type { AppealDetail, AppealSummary } from "@/types/moderation.type";

import { applyModerationStateToPlatformUser, changeUserStrikeCount, findPlatformUserRecordOrFail, findRecordByIdOrFail, presentModeratedUser, readTrustStore, recordPriorActionOnAuthor } from "./trustStore.mock";

function presentAppealSummary(record: MockAppealRecord): AppealSummary {
  const { appellantUserId, decision, strikeWasIssued, ...summary } = record;
  return { ...summary, appellant: presentModeratedUser(appellantUserId) };
}

function presentAppealDetail(record: MockAppealRecord): AppealDetail {
  return { ...presentAppealSummary(record), decision: record.decision, history: listMockAuditEntriesForTarget("appeal", record.id) };
}

function snapshotAppealState(record: MockAppealRecord) {
  const appellant = findPlatformUserRecordOrFail(record.appellantUserId);
  return { appealStatus: record.status, targetVisibility: record.target.visibility, appellantStatus: appellant.status, appellantStrikes: presentModeratedUser(appellant.id).strikeCount };
}

function restoreTargetAfterOverturn(record: MockAppealRecord): void {
  record.target = { ...record.target, visibility: "VISIBLE" };
  if (record.strikeWasIssued) changeUserStrikeCount(record.appellantUserId, -1);
  const appellant = findPlatformUserRecordOrFail(record.appellantUserId);
  if (record.decisionType === "SUSPENSION" && appellant.status === "SUSPENDED") applyModerationStateToPlatformUser(appellant.id, { status: "ACTIVE" });
  const matchingReport = readTrustStore().reports.find((report) => report.target.id === record.target.id);
  if (matchingReport) matchingReport.target = { ...matchingReport.target, visibility: "VISIBLE" };
}

export function registerModerationAppealMockHandlers(): void {
  registerMockRoute("GET", "/admin/appeals", (request) => {
    requireMockPermission(request, "moderation:appeals");
    const status = request.query.get("status") ?? "PENDING";
    const decisionType = request.query.get("decisionType");
    const search = request.query.get("search");
    const appeals = readTrustStore()
      .appeals.filter((record) => (status === "ALL" || record.status === status) && (!decisionType || record.decisionType === decisionType))
      .filter((record) => matchesSearchText(search, record.id, record.userStatement, findPlatformUserRecordOrFail(record.appellantUserId).username))
      .sort((first, second) => first.slaDueAt.localeCompare(second.slaDueAt))
      .map(presentAppealSummary);
    return respondWithJson(200, paginateByCursor(appeals, request));
  });

  registerMockRoute("GET", "/admin/appeals/:appealId", (request) => {
    requireMockPermission(request, "moderation:appeals");
    return respondWithJson(200, presentAppealDetail(findRecordByIdOrFail(readTrustStore().appeals, request.params.appealId, "Appeal")));
  });

  registerMockRoute("POST", "/admin/appeals/:appealId/decide", (request) => {
    requireMockPermission(request, "moderation:appeals");
    const body = readJsonObjectBody(request);
    const outcome = readEnumValue(body, "outcome", ["UPHELD", "OVERTURNED"] as const);
    const reason = readRequiredReason(body);
    const record = findRecordByIdOrFail(readTrustStore().appeals, request.params.appealId, "Appeal");
    if (record.status !== "PENDING") throw new MockHttpError(409, "APPEAL_ALREADY_DECIDED", "This appeal was already decided. Reload to see the outcome.");
    if (record.originalDecision.decidedByName === request.principal?.name) throw new MockHttpError(409, "SAME_REVIEWER", "A different admin must decide an appeal against your own decision.");
    const before = snapshotAppealState(record);
    if (outcome === "OVERTURNED") {
      restoreTargetAfterOverturn(record);
      recordPriorActionOnAuthor(record.appellantUserId, "APPEAL_OVERTURNED", reason);
    }
    record.status = outcome;
    record.decision = { outcome, reason, decidedByName: request.principal?.name ?? "System", decidedAt: new Date().toISOString() };
    recordMockAuditEntry(request, { action: `appeal.${outcome.toLowerCase()}`, area: "moderation", target: { type: "appeal", id: record.id, label: `@${findPlatformUserRecordOrFail(record.appellantUserId).username}` }, reason, before, after: snapshotAppealState(record) });
    return respondWithJson(200, presentAppealDetail(record));
  });
}
