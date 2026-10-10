import { listMockAuditEntriesForTarget, recordMockAuditEntry } from "@/mocks/mockAudit.mock";
import { requireMockPermission, requireMockStepUp } from "@/mocks/mockGuards.mock";
import { MockHttpError, failValidation, matchesSearchText, paginateByCursor, readEnumValue, readIsoNow, readIsoTimeOffset, readJsonObjectBody, readRequiredReason, respondWithJson } from "@/mocks/mockResponses.mock";
import { registerMockRoute, type MockRequest } from "@/mocks/mockRouter.mock";
import type { MockChatReportRecord } from "@/mocks/seed/trustChatReports.mock";
import { chatReportActions } from "@/constants/chatReportOptions.constant";
import type { ChatReportAction, ChatReportDetail, ChatReportSummary, ReporterOutcome } from "@/types/chatReport.type";

import { blockSignupIdentifiers, notifyUser } from "../people/peopleUserActions.mock";
import { asMutablePlatformUser, findPlatformUserForPeopleOrFail, readUserExtrasForPeople } from "../people/peopleStore.mock";
import { findRecordByIdOrFail, presentModeratedUser, readTrustStore } from "./trustStore.mock";

const priorityRank = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 } as const;
const actionPermissions = { DISMISS: "chat-reports:review", REMOVE_GROUP: "chat-reports:review", WARN_USER: "users:moderate", RESTRICT_USER: "users:restrict", SUSPEND_USER: "users:suspend", BAN_USER: "users:ban", ESCALATE_LEGAL: "chat-reports:legal" } as const;
const userActions: readonly ChatReportAction[] = ["WARN_USER", "RESTRICT_USER", "SUSPEND_USER", "BAN_USER"];
const minimumRetentionDays = 30;
const maximumRetentionDays = 730;

const isStillOpen = (record: MockChatReportRecord) => record.status === "OPEN" || record.status === "IN_REVIEW";
const isChildSafety = (record: MockChatReportRecord) => record.reason === "CHILD_SAFETY";

function presentSummary(record: MockChatReportRecord): ChatReportSummary {
  return {
    id: record.id, targetType: record.targetType, reason: record.reason, priority: record.priority, status: record.status,
    reporter: presentModeratedUser(record.reporterUserId),
    reportedUser: record.reportedUserId ? presentModeratedUser(record.reportedUserId) : null,
    conversationLabel: record.conversationLabel, createdAt: record.createdAt, slaDueAt: record.slaDueAt,
    evidenceCount: record.transcript.length, spamScore: record.spamScore, isLegalReview: record.isLegalReview,
  };
}

function presentDetail(record: MockChatReportRecord): ChatReportDetail {
  return {
    ...presentSummary(record),
    details: record.details, evidenceSelection: record.evidenceSelection, evidenceHash: record.evidenceHash, isEvidenceHashVerified: record.evidenceHash !== null,
    evidenceRetainedUntil: record.evidenceRetainedUntil, reporterBlockedReportedUser: record.reporterBlockedReportedUser,
    transcript: record.transcript.map((message) => ({ messageId: message.messageId, senderId: message.senderUserId, senderName: message.senderName, isReportedUser: message.senderUserId === record.reportedUserId, sentAt: message.sentAt, text: message.text, attachments: message.attachments })),
    decision: record.decision, reporterOutcome: record.reporterOutcome, history: listMockAuditEntriesForTarget("chat_report", record.id),
  };
}

function applyActionToReportedUser(request: MockRequest, action: ChatReportAction, userId: string, reason: string, body: Record<string, unknown>): void {
  const user = findPlatformUserForPeopleOrFail(userId);
  if (user.status === "BANNED" || user.status === "DELETED") throw new MockHttpError(409, "USER_UNAVAILABLE", `@${user.username} is already ${user.status.toLowerCase()}.`);
  const extras = readUserExtrasForPeople(user.id);
  const mutableUser = asMutablePlatformUser(user);
  const before = { status: user.status, restriction: extras.restriction };
  const durationDays = typeof body.durationDays === "number" && Number.isInteger(body.durationDays) && body.durationDays >= 1 && body.durationDays <= 365 ? body.durationDays : null;
  if (action === "WARN_USER") {
    if (user.status === "ACTIVE") mutableUser.status = "WARNED";
    notifyUser(user, "A message you sent broke our rules", `Please review the community guidelines. Reason: ${reason}`);
  } else if (action === "RESTRICT_USER") {
    extras.restriction = { kind: "FEATURE_RESTRICTION", features: ["MESSAGING"], reason, startedAt: readIsoNow(), endsAt: readIsoTimeOffset((durationDays ?? 7) * 1440) };
    notifyUser(user, "Messaging is limited", `For ${durationDays ?? 7} days you cannot send messages. Reason: ${reason}`);
  } else if (action === "SUSPEND_USER") {
    if (durationDays === null) failValidation("durationDays", "Choose a suspension length.");
    mutableUser.status = "SUSPENDED";
    extras.restriction = { kind: "SUSPENSION", reason, startedAt: readIsoNow(), endsAt: readIsoTimeOffset(durationDays * 1440) };
    extras.sessions = [];
    notifyUser(user, "Your account is suspended", `Your account is suspended for ${durationDays} days. Reason: ${reason}. You can appeal from the app.`);
  } else {
    mutableUser.status = "BANNED";
    extras.restriction = { kind: "BAN", reason, startedAt: readIsoNow(), endsAt: null };
    extras.sessions = [];
    blockSignupIdentifiers(user);
    notifyUser(user, "Your account was closed", `Your account was banned. Reason: ${reason}.`);
  }
  recordMockAuditEntry(request, { action: `user.chat_report.${action.toLowerCase()}`, area: "users", target: { type: "user", id: user.id, label: `@${user.username}` }, reason, before, after: { status: user.status, restriction: extras.restriction, userNotified: true } });
}

function notifyReporterOfOutcome(record: MockChatReportRecord, outcome: ReporterOutcome): void {
  const reporter = findPlatformUserForPeopleOrFail(record.reporterUserId);
  notifyUser(reporter, outcome === "TOOK_ACTION" ? "We took action" : "No violation found", outcome === "TOOK_ACTION" ? "Thanks for your report. We reviewed it and took action." : "We reviewed your report and didn't find a violation. You can still block, mute or restrict this chat.");
}

function decideReport(request: MockRequest, record: MockChatReportRecord, action: ChatReportAction, reason: string, body: Record<string, unknown>): void {
  if (action === "REMOVE_GROUP" && record.targetType !== "GROUP") throw new MockHttpError(409, "NOT_A_GROUP_REPORT", "Only group reports can remove a group.");
  if (userActions.includes(action) && !record.reportedUserId) throw new MockHttpError(409, "NO_REPORTED_USER", "This report is about a group. Remove the group or dismiss instead.");
  if (action === "BAN_USER" || action === "REMOVE_GROUP" || action === "ESCALATE_LEGAL") requireMockStepUp(request);
  const before = { status: record.status };
  if (userActions.includes(action) && record.reportedUserId) applyActionToReportedUser(request, action, record.reportedUserId, reason, body);
  record.status = action === "DISMISS" ? "DISMISSED" : action === "ESCALATE_LEGAL" ? "ESCALATED_LEGAL" : "ACTIONED";
  record.isLegalReview = action === "ESCALATE_LEGAL" || record.isLegalReview;
  const durationDays = typeof body.durationDays === "number" && action === "SUSPEND_USER" ? body.durationDays : null;
  record.decision = { chatAction: action, reason, decidedByName: request.principal?.name ?? "System", decidedAt: readIsoNow(), suspensionDays: durationDays };
  if (action !== "ESCALATE_LEGAL") {
    record.reporterOutcome = action === "DISMISS" ? "NO_VIOLATION" : "TOOK_ACTION";
    notifyReporterOfOutcome(record, record.reporterOutcome);
  }
  recordMockAuditEntry(request, { action: `chat_report.${action.toLowerCase()}`, area: "moderation", target: { type: "chat_report", id: record.id, label: `${record.targetType.toLowerCase()} report ${record.id}` }, reason, before, after: { status: record.status, evidenceRetainedUntil: record.evidenceRetainedUntil } });
}

export function registerChatReportMockHandlers(): void {
  registerMockRoute("GET", "/admin/chat-reports/retention", (request) => {
    requireMockPermission(request, "chat-reports:review", "chat-reports:legal");
    return respondWithJson(200, { ...readTrustStore().chatEvidenceSettings, label: "LEGAL REVIEW" });
  });

  registerMockRoute("PUT", "/admin/chat-reports/retention", (request) => {
    requireMockPermission(request, "chat-reports:legal");
    requireMockStepUp(request);
    const body = readJsonObjectBody(request);
    const reason = readRequiredReason(body);
    const retentionDays = Number(body.retentionDays);
    if (!Number.isInteger(retentionDays) || retentionDays < minimumRetentionDays || retentionDays > maximumRetentionDays) failValidation("retentionDays", `Choose between ${minimumRetentionDays} and ${maximumRetentionDays} days.`);
    const store = readTrustStore();
    const before = { ...store.chatEvidenceSettings };
    store.chatEvidenceSettings = { ...before, retentionDays };
    recordMockAuditEntry(request, { action: "chat_report.retention_changed", area: "moderation", target: { type: "chat_report_settings", id: "retention", label: "Chat evidence retention" }, reason, before, after: store.chatEvidenceSettings });
    return respondWithJson(200, { ...store.chatEvidenceSettings, label: "LEGAL REVIEW" });
  });

  registerMockRoute("GET", "/admin/chat-reports", (request) => {
    requireMockPermission(request, "chat-reports:review", "chat-reports:legal");
    const status = request.query.get("status") ?? "OPEN";
    const reason = request.query.get("reason");
    const priority = request.query.get("priority");
    const targetType = request.query.get("targetType");
    const search = request.query.get("search");
    const reports = readTrustStore()
      .chatReports.filter((record) => (status === "OPEN" ? isStillOpen(record) : status === "ALL" || record.status === status))
      .filter((record) => (!reason || record.reason === reason) && (!priority || record.priority === priority) && (!targetType || record.targetType === targetType))
      .filter((record) => matchesSearchText(search, record.id, record.conversationLabel, record.details))
      .sort((first, second) => Number(isChildSafety(second)) - Number(isChildSafety(first)) || priorityRank[first.priority] - priorityRank[second.priority] || first.slaDueAt.localeCompare(second.slaDueAt))
      .map(presentSummary);
    return respondWithJson(200, paginateByCursor(reports, request));
  });

  registerMockRoute("GET", "/admin/chat-reports/:reportId", (request) => {
    requireMockPermission(request, "chat-reports:review", "chat-reports:legal");
    return respondWithJson(200, presentDetail(findRecordByIdOrFail(readTrustStore().chatReports, request.params.reportId, "Chat report")));
  });

  registerMockRoute("POST", "/admin/chat-reports/:reportId/actions", (request) => {
    const body = readJsonObjectBody(request);
    const action = readEnumValue(body, "action", chatReportActions);
    requireMockPermission(request, actionPermissions[action]);
    const reason = readRequiredReason(body);
    const record = findRecordByIdOrFail(readTrustStore().chatReports, request.params.reportId, "Chat report");
    if (!isStillOpen(record)) throw new MockHttpError(409, "REPORT_ALREADY_DECIDED", "Someone already decided this report. Reload to see the outcome.");
    decideReport(request, record, action, reason, body);
    return respondWithJson(200, presentDetail(record));
  });
}
