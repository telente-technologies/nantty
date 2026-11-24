import { listMockAuditEntriesForTarget, recordMockAuditEntry } from "@/mocks/mockAudit.mock";
import { requireMockPermission, requireMockStepUp } from "@/mocks/mockGuards.mock";
import { MockHttpError, failValidation, matchesSearchText, paginateByCursor, readEnumValue, readJsonObjectBody, readRequiredReason, respondWithJson } from "@/mocks/mockResponses.mock";
import { registerMockRoute, type MockRequest } from "@/mocks/mockRouter.mock";
import type { MockReportRecord } from "@/mocks/seed/trustReports.mock";
import type { ContentModerationAction, ContentVisibility, ModerationAction, ReportDetail, ReportSummary } from "@/types/moderation.type";

import { applyModerationStateToPlatformUser, changeUserStrikeCount, findPlatformUserRecordOrFail, findRecordByIdOrFail, presentModeratedUser, readPriorActionsOnAuthor, readTrustStore, recordPriorActionOnAuthor } from "./trustStore.mock";

const priorityRank = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 } as const;
const contentActions: readonly ContentModerationAction[] = ["DISMISS", "HIDE", "RESTRICT", "REMOVE", "WARN_AUTHOR"];
const visibilityByContentAction: Partial<Record<ContentModerationAction, ContentVisibility>> = { HIDE: "HIDDEN", RESTRICT: "RESTRICTED", REMOVE: "REMOVED" };
const allowedSuspensionDays = [1, 3, 7, 30] as const;

function presentReportSummary(record: MockReportRecord): ReportSummary {
  const { authorUserId, reporterNotes, classifierScores, decision, ...summary } = record;
  return { ...summary, reasonCounts: [...summary.reasonCounts], author: presentModeratedUser(authorUserId), reportCount: record.reasonCounts.reduce((total, entry) => total + entry.count, 0) };
}

function presentReportDetail(record: MockReportRecord): ReportDetail {
  return {
    ...presentReportSummary(record),
    reporterNotes: record.reporterNotes,
    classifierScores: record.classifierScores,
    priorActionsOnAuthor: readPriorActionsOnAuthor(record.authorUserId),
    decision: record.decision,
    history: listMockAuditEntriesForTarget("report", record.id),
  };
}

function isReportStillOpen(record: MockReportRecord): boolean {
  return record.status === "OPEN" || record.status === "IN_REVIEW";
}

function findOpenReportOrFail(request: MockRequest): MockReportRecord {
  const record = findRecordByIdOrFail(readTrustStore().reports, request.params.reportId, "Report");
  if (!isReportStillOpen(record)) throw new MockHttpError(409, "REPORT_ALREADY_DECIDED", "Someone already decided this report. Reload to see the outcome.");
  return record;
}

function snapshotReportState(record: MockReportRecord) {
  const author = findPlatformUserRecordOrFail(record.authorUserId);
  return { reportStatus: record.status, targetVisibility: record.target.visibility, authorStatus: author.status, authorVerification: author.verification, authorStrikes: presentModeratedUser(record.authorUserId).strikeCount };
}

function auditTargetForReport(record: MockReportRecord) {
  return { type: "report", id: record.id, label: `${record.target.type.toLowerCase()} ${record.target.id}` };
}

function auditTargetForAuthor(record: MockReportRecord) {
  const author = findPlatformUserRecordOrFail(record.authorUserId);
  return { type: "user", id: author.id, label: `@${author.username}` };
}

function recordReportDecision(request: MockRequest, record: MockReportRecord, action: ModerationAction, reason: string, suspensionDays: number | null, before: ReturnType<typeof snapshotReportState>) {
  record.decision = { action, reason, decidedByName: request.principal?.name ?? "System", decidedAt: new Date().toISOString(), suspensionDays };
  const after = snapshotReportState(record);
  recordMockAuditEntry(request, { action: `report.${action.toLowerCase()}`, area: "moderation", target: auditTargetForReport(record), reason, before, after });
  if (action !== "DISMISS" && action !== "HIDE" && action !== "RESTRICT") {
    recordMockAuditEntry(request, { action: `user.moderated.${action.toLowerCase()}`, area: "moderation", target: auditTargetForAuthor(record), reason, before: { status: before.authorStatus, strikes: before.authorStrikes, verification: before.authorVerification }, after: { status: after.authorStatus, strikes: after.authorStrikes, verification: after.authorVerification, reportId: record.id } });
    recordPriorActionOnAuthor(record.authorUserId, action, reason);
  }
}

export function registerModerationReportMockHandlers(): void {
  registerMockRoute("GET", "/admin/reports", (request) => {
    requireMockPermission(request, "moderation:reports");
    const status = request.query.get("status") ?? "OPEN";
    const targetType = request.query.get("targetType");
    const reason = request.query.get("reason");
    const priority = request.query.get("priority");
    const search = request.query.get("search");
    const reports = readTrustStore()
      .reports.filter((record) => (status === "OPEN" ? isReportStillOpen(record) : status === "ALL" || record.status === status))
      .filter((record) => (!targetType || record.target.type === targetType) && (!reason || record.reasonCounts.some((entry) => entry.reason === reason)) && (!priority || record.priority === priority))
      .filter((record) => matchesSearchText(search, record.id, record.target.id, record.target.text, record.target.title, findPlatformUserRecordOrFail(record.authorUserId).username))
      .sort((first, second) => priorityRank[first.priority] - priorityRank[second.priority] || first.slaDueAt.localeCompare(second.slaDueAt))
      .map(presentReportSummary);
    return respondWithJson(200, paginateByCursor(reports, request));
  });

  registerMockRoute("GET", "/admin/reports/:reportId", (request) => {
    requireMockPermission(request, "moderation:reports");
    return respondWithJson(200, presentReportDetail(findRecordByIdOrFail(readTrustStore().reports, request.params.reportId, "Report")));
  });

  registerMockRoute("POST", "/admin/reports/:reportId/actions", (request) => {
    requireMockPermission(request, "moderation:reports");
    const body = readJsonObjectBody(request);
    const action = readEnumValue(body, "action", contentActions);
    const reason = readRequiredReason(body);
    const record = findOpenReportOrFail(request);
    const before = snapshotReportState(record);
    const targetVisibility = visibilityByContentAction[action];
    if (targetVisibility) record.target = { ...record.target, visibility: targetVisibility };
    if (action === "REMOVE" || action === "WARN_AUTHOR") changeUserStrikeCount(record.authorUserId, 1);
    if (action === "WARN_AUTHOR" && findPlatformUserRecordOrFail(record.authorUserId).status === "ACTIVE") applyModerationStateToPlatformUser(record.authorUserId, { status: "WARNED" });
    record.status = action === "DISMISS" ? "DISMISSED" : "RESOLVED";
    recordReportDecision(request, record, action, reason, null, before);
    return respondWithJson(200, presentReportDetail(record));
  });

  registerMockRoute("POST", "/admin/reports/:reportId/suspend-author", (request) => {
    requireMockPermission(request, "moderation:reports");
    requireMockStepUp(request);
    const body = readJsonObjectBody(request);
    const reason = readRequiredReason(body);
    const durationDays = Number(body.durationDays);
    if (!(allowedSuspensionDays as readonly number[]).includes(durationDays)) failValidation("durationDays", `Choose ${allowedSuspensionDays.join(", ")} days.`);
    const record = findOpenReportOrFail(request);
    const author = findPlatformUserRecordOrFail(record.authorUserId);
    if (author.status === "BANNED" || author.status === "SUSPENDED") throw new MockHttpError(409, "AUTHOR_ALREADY_RESTRICTED", `@${author.username} is already ${author.status.toLowerCase()}.`);
    const before = snapshotReportState(record);
    applyModerationStateToPlatformUser(author.id, { status: "SUSPENDED" });
    changeUserStrikeCount(author.id, 1);
    record.target = { ...record.target, visibility: "HIDDEN" };
    record.status = "RESOLVED";
    recordReportDecision(request, record, "SUSPEND_AUTHOR", reason, durationDays, before);
    return respondWithJson(200, presentReportDetail(record));
  });

  registerMockRoute("POST", "/admin/reports/:reportId/revoke-author-verification", (request) => {
    requireMockPermission(request, "verification:revoke");
    requireMockPermission(request, "moderation:reports");
    requireMockStepUp(request);
    const reason = readRequiredReason(readJsonObjectBody(request));
    const record = findOpenReportOrFail(request);
    const author = findPlatformUserRecordOrFail(record.authorUserId);
    if (!author.verification || author.verification.status === "REVOKED") throw new MockHttpError(409, "NOT_VERIFIED", `@${author.username} has no active verification to revoke.`);
    const before = snapshotReportState(record);
    applyModerationStateToPlatformUser(author.id, { verification: { ...author.verification, status: "REVOKED", badgeVisible: false } });
    record.status = "RESOLVED";
    recordReportDecision(request, record, "REVOKE_AUTHOR_VERIFICATION", reason, null, before);
    return respondWithJson(200, presentReportDetail(record));
  });

  registerMockRoute("GET", "/admin/moderation/child-safety/quarantine", (request) => {
    requireMockPermission(request, "moderation:reports");
    return respondWithJson(200, {
      items: [
        { id: "csq_1", mediaId: "med_quarantine_01", ownerId: "usr_0091", sha256Hex: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", provider: "PHOTO_DNA", status: "QUARANTINED", detectedAt: "2026-11-15T14:20:00Z" },
      ],
    });
  });
}
