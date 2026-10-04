import { listMockAuditEntriesForTarget, recordMockAuditEntry } from "@/mocks/mockAudit.mock";
import { requireMockPermission } from "@/mocks/mockGuards.mock";
import { MockHttpError, matchesSearchText, paginateItems, readJsonObjectBody, readRequiredReason, respondWithJson } from "@/mocks/mockResponses.mock";
import { registerMockRoute, type MockRequest } from "@/mocks/mockRouter.mock";
import type { MockCopyrightClaimRecord } from "@/mocks/seed/trustCopyright.mock";
import type { CopyrightClaimDetail, CopyrightClaimStatus, CopyrightClaimSummary } from "@/types/copyright.type";

import { applyMockUpheldRemedy } from "./copyrightRemedies.mock";
import { changeUserStrikeCount, findPlatformUserRecordOrFail, findRecordByIdOrFail, presentModeratedUser, readTrustStore, recordPriorActionOnAuthor } from "./trustStore.mock";

export const repeatInfringerStrikeThreshold = 3;

function presentClaimSummary(record: MockCopyrightClaimRecord): CopyrightClaimSummary {
  const infringer = presentModeratedUser(record.infringerUserId);
  const topMatch = record.audioMatches.reduce<number | null>((best, match) => (best === null || match.confidencePercent > best ? match.confidencePercent : best), null);
  return {
    id: record.id, claimant: record.claimant, workTitle: record.workTitle, workType: record.workType, target: record.target, infringer,
    targetFlag: record.targetFlag, status: record.status, filedAt: record.filedAt, topAudioMatchConfidencePercent: topMatch, infringerStrikeCount: infringer.strikeCount,
    claimScope: record.claimScope ?? (record.workType === "SOUND" ? "AUDIO" : "VIDEO"), remedy: record.remedy ?? "NONE", remedyState: record.remedyState ?? "NONE", takedownDeadlineAt: record.takedownDeadlineAt ?? null,
  };
}

function presentClaimDetail(record: MockCopyrightClaimRecord): CopyrightClaimDetail {
  return {
    ...presentClaimSummary(record), rightsBasis: record.rightsBasis, swornStatement: record.swornStatement, claimedUrls: record.claimedUrls, audioMatches: record.audioMatches,
    counterNotices: record.counterNotices, evidence: record.evidence, repeatInfringerThreshold: repeatInfringerStrikeThreshold, decision: record.decision, history: listMockAuditEntriesForTarget("copyrightClaim", record.id),
  };
}

function snapshotClaimState(record: MockCopyrightClaimRecord) {
  return { status: record.status, targetFlag: record.targetFlag, targetVisibility: record.target.visibility, infringerStrikes: presentModeratedUser(record.infringerUserId).strikeCount, counterNotices: record.counterNotices.map((notice) => ({ id: notice.id, status: notice.status })) };
}

function findClaimInStatusOrFail(request: MockRequest, allowedStatuses: readonly CopyrightClaimStatus[]): MockCopyrightClaimRecord {
  const record = findRecordByIdOrFail(readTrustStore().copyrightClaims, request.params.claimId, "Copyright claim");
  if (!allowedStatuses.includes(record.status)) throw new MockHttpError(409, "CLAIM_STATE_CONFLICT", `This claim is ${record.status.toLowerCase().replace(/_/g, " ")}; that action is not available.`);
  return record;
}

function finishClaimChange(request: MockRequest, record: MockCopyrightClaimRecord, action: string, reason: string, before: ReturnType<typeof snapshotClaimState>) {
  recordMockAuditEntry(request, { action: `copyright.${action}`, area: "copyright", target: { type: "copyrightClaim", id: record.id, label: record.workTitle }, reason, before, after: snapshotClaimState(record) });
  return respondWithJson(200, presentClaimDetail(record));
}

function decideClaim(record: MockCopyrightClaimRecord, request: MockRequest, outcome: string, reason: string): void {
  record.decision = { outcome, reason, decidedByName: request.principal?.name ?? "System", decidedAt: new Date().toISOString() };
}

export function registerCopyrightClaimMockHandlers(): void {
  registerMockRoute("GET", "/admin/copyright-claims", (request) => {
    requireMockPermission(request, "copyright:review");
    const status = request.query.get("status") ?? "OPEN";
    const workType = request.query.get("workType");
    const search = request.query.get("search");
    const openStatuses: readonly CopyrightClaimStatus[] = ["PENDING", "NEEDS_INFO", "COUNTER_NOTICE"];
    const claims = readTrustStore()
      .copyrightClaims.filter((record) => (status === "OPEN" ? openStatuses.includes(record.status) : status === "ALL" || record.status === status) && (!workType || record.workType === workType))
      .filter((record) => matchesSearchText(search, record.id, record.workTitle, record.claimant.name, record.claimant.organization, findPlatformUserRecordOrFail(record.infringerUserId).username))
      .sort((first, second) => first.filedAt.localeCompare(second.filedAt))
      .map(presentClaimSummary);
    return respondWithJson(200, paginateItems(claims, request));
  });

  registerMockRoute("GET", "/admin/copyright-claims/:claimId", (request) => {
    requireMockPermission(request, "copyright:review");
    return respondWithJson(200, presentClaimDetail(findRecordByIdOrFail(readTrustStore().copyrightClaims, request.params.claimId, "Copyright claim")));
  });

  registerMockRoute("POST", "/admin/copyright-claims/:claimId/uphold", (request) => {
    requireMockPermission(request, "copyright:review");
    const reason = readRequiredReason(readJsonObjectBody(request));
    const record = findClaimInStatusOrFail(request, ["PENDING", "NEEDS_INFO"]);
    const before = snapshotClaimState(record);
    record.status = "UPHELD";
    const { remedy, issuesStrike } = applyMockUpheldRemedy(record);
    decideClaim(record, request, "UPHELD", reason);
    if (!issuesStrike) return finishClaimChange(request, record, remedy === "AUDIO_MUTED" ? "upheld_audio_muted" : "upheld_warning_issued", reason, before);
    const strikeCount = changeUserStrikeCount(record.infringerUserId, 1);
    recordPriorActionOnAuthor(record.infringerUserId, "COPYRIGHT_STRIKE", `${record.workTitle}: ${reason}`);
    const infringer = findPlatformUserRecordOrFail(record.infringerUserId);
    recordMockAuditEntry(request, { action: "user.copyright_strike_added", area: "copyright", target: { type: "user", id: infringer.id, label: `@${infringer.username}` }, reason, before: { strikes: before.infringerStrikes }, after: { strikes: strikeCount, claimId: record.id, isRepeatInfringer: strikeCount >= repeatInfringerStrikeThreshold } });
    return finishClaimChange(request, record, "upheld", reason, before);
  });

  registerMockRoute("POST", "/admin/copyright-claims/:claimId/reject", (request) => {
    requireMockPermission(request, "copyright:review");
    const reason = readRequiredReason(readJsonObjectBody(request));
    const record = findClaimInStatusOrFail(request, ["PENDING", "NEEDS_INFO"]);
    const before = snapshotClaimState(record);
    record.status = "REJECTED";
    record.targetFlag = "VISIBLE";
    record.target = { ...record.target, visibility: "VISIBLE" };
    decideClaim(record, request, "REJECTED", reason);
    return finishClaimChange(request, record, "rejected", reason, before);
  });

  registerMockRoute("POST", "/admin/copyright-claims/:claimId/audio-match", (request) => {
    requireMockPermission(request, "copyright:review");
    const record = findRecordByIdOrFail(readTrustStore().copyrightClaims, request.params.claimId, "Copyright claim");
    if (!record.evidence?.originalWorkMediaId && record.audioMatches.length === 0) throw new MockHttpError(409, "AUDIO_MATCH_NOT_POSSIBLE", "An audio match needs the original work uploaded with the claim and video or audio on the claimed content.");
    if (record.audioMatches.length === 0) record.audioMatches = [{ matchedTrack: record.workTitle, artist: record.claimant.organization ?? record.claimant.name, confidencePercent: 88, source: "Chromaprint fingerprint (advice only)", segments: [{ targetStartSeconds: 0, targetEndSeconds: 24, referenceStartSeconds: 12 }] }];
    return respondWithJson(200, presentClaimDetail(record));
  });

  registerMockRoute("POST", "/admin/copyright-claims/:claimId/request-info", (request) => {
    requireMockPermission(request, "copyright:review");
    const reason = readRequiredReason(readJsonObjectBody(request));
    const record = findClaimInStatusOrFail(request, ["PENDING"]);
    const before = snapshotClaimState(record);
    record.status = "NEEDS_INFO";
    return finishClaimChange(request, record, "info_requested", reason, before);
  });

  for (const decision of ["accept", "reject"] as const) {
    registerMockRoute("POST", `/admin/copyright-claims/:claimId/counter-notices/:noticeId/${decision}`, (request) => {
      requireMockPermission(request, "copyright:review");
      const reason = readRequiredReason(readJsonObjectBody(request));
      const record = findClaimInStatusOrFail(request, ["COUNTER_NOTICE"]);
      const notice = findRecordByIdOrFail(record.counterNotices, request.params.noticeId, "Counter-notice");
      if (notice.status !== "PENDING") throw new MockHttpError(409, "COUNTER_NOTICE_DECIDED", "This counter-notice was already decided.");
      const before = snapshotClaimState(record);
      record.counterNotices = record.counterNotices.map((candidate) => (candidate.id === notice.id ? { ...candidate, status: decision === "accept" ? "ACCEPTED" : "REJECTED" } : candidate));
      if (decision === "reject") record.status = "UPHELD";
      return finishClaimChange(request, record, `counter_notice_${decision}ed`, reason, before);
    });
  }
}
