import { documentsThatAlwaysNotifyUsers, mockHardBouncedAddresses, mockSuppressedAddresses, sesBatchSize, sesRatePerSecond, totalMockRegisteredUsers } from "@/constants/legalDocuments.constant";
import { recordMockAuditEntry } from "@/mocks/mockAudit.mock";
import { requireMockPermission, requireMockStepUp } from "@/mocks/mockGuards.mock";
import { failConflict, failNotFound, createMockId, readJsonObjectBody, readRequiredReason, respondWithJson } from "@/mocks/mockResponses.mock";
import { registerMockRoute, type MockRequest } from "@/mocks/mockRouter.mock";
import type { MutableLegalVersion } from "@/mocks/seed/legalDocuments.mock";
import type { LegalAcceptanceStats, LegalNoticePreview } from "@/types/legal.type";

import { readNoticeDraft } from "./legalNoticeDrafts.mock";
import { findVersionOrFail, presentNoticeProgress, readLegalStore, readSendableRecipientCount, type LegalNoticeRecord } from "./legalStore.mock";

const dayMilliseconds = 86_400_000;

export function shouldNotifyUsersAboutPublish(version: MutableLegalVersion): boolean {
  return documentsThatAlwaysNotifyUsers.includes(version.documentKey) || version.isMaterialChange;
}

export function queueLegalNotice(request: MockRequest, version: MutableLegalVersion, queuedByName: string, reason: string | null): LegalNoticeRecord {
  const record: LegalNoticeRecord = { id: createMockId("lgn"), documentKey: version.documentKey, versionId: version.id, versionNumber: version.versionNumber, queuedAtEpochMs: Date.now(), queuedByName };
  readLegalStore().notices.unshift(record);
  version.noticeId = record.id;
  const progress = presentNoticeProgress(record);
  recordMockAuditEntry(request, { action: "legal_notice.queued", area: "legal", target: { type: "legalNotice", id: record.id, label: `${progress.documentTitle} v${version.versionNumber}` }, reason, after: { recipientCount: progress.recipientCount, excludedHardBounces: progress.excludedHardBounces, excludedSuppressed: progress.excludedSuppressed, batchSize: progress.batchSize, ratePerSecond: progress.ratePerSecond, sentWithoutMarketingConsent: true, provider: "AWS_SES" } });
  return record;
}

function buildPreview(version: MutableLegalVersion): LegalNoticePreview {
  const recipientCount = readSendableRecipientCount();
  const batchesTotal = Math.ceil(recipientCount / sesBatchSize);
  const draft = readNoticeDraft(version);
  return { draft, subject: draft.subject, totalUsers: totalMockRegisteredUsers, excludedHardBounces: mockHardBouncedAddresses, excludedSuppressed: mockSuppressedAddresses, recipientCount, batchSize: sesBatchSize, ratePerSecond: sesRatePerSecond, batchesTotal, estimatedMinutes: Math.ceil(recipientCount / sesRatePerSecond / 60), sendsWithoutMarketingConsent: true };
}

function buildAcceptanceStats(version: MutableLegalVersion): LegalAcceptanceStats {
  const requiredCount = readSendableRecipientCount();
  const daysSincePublish = version.publishedAt ? Math.max(0, (Date.now() - Date.parse(version.publishedAt)) / dayMilliseconds) : 0;
  const acceptedCount = version.isMaterialChange && version.status === "PUBLISHED" ? Math.floor(requiredCount * Math.min(0.85, daysSincePublish / 40)) : 0;
  return { requiredCount: version.isMaterialChange ? requiredCount : 0, acceptedCount, mustAcceptBy: version.isMaterialChange ? version.effectiveAt : null };
}

export function registerLegalNoticeMockHandlers(): void {
  registerMockRoute("GET", "/admin/legal/notices", (request) => {
    requireMockPermission(request, "legal.documents.view", "legal.notices.send");
    return respondWithJson(200, { items: readLegalStore().notices.map(presentNoticeProgress) });
  });

  registerMockRoute("GET", "/admin/legal/notices/:noticeId", (request) => {
    requireMockPermission(request, "legal.documents.view", "legal.notices.send");
    const record = readLegalStore().notices.find((candidate) => candidate.id === request.params.noticeId);
    if (!record) failNotFound("Notice");
    return respondWithJson(200, presentNoticeProgress(record));
  });

  registerMockRoute("GET", "/admin/legal/versions/:versionId/notice-preview", (request) => {
    requireMockPermission(request, "legal.documents.view", "legal.notices.send");
    return respondWithJson(200, buildPreview(findVersionOrFail(request.params.versionId ?? "")));
  });

  registerMockRoute("GET", "/admin/legal/versions/:versionId/acceptance", (request) => {
    requireMockPermission(request, "legal.documents.view");
    return respondWithJson(200, buildAcceptanceStats(findVersionOrFail(request.params.versionId ?? "")));
  });

  registerMockRoute("POST", "/admin/legal/notices", (request) => {
    const principal = requireMockPermission(request, "legal.notices.send");
    requireMockStepUp(request);
    const body = readJsonObjectBody(request);
    const reason = readRequiredReason(body);
    const version = findVersionOrFail(typeof body.versionId === "string" ? body.versionId : "");
    if (version.status !== "PUBLISHED") failConflict("NOT_PUBLISHED", "Only a published version can be sent to users.");
    const running = readLegalStore().notices.find((candidate) => candidate.versionId === version.id && presentNoticeProgress(candidate).status !== "COMPLETED");
    if (running) failConflict("NOTICE_IN_PROGRESS", "A notice for this version is still sending.");
    return respondWithJson(201, presentNoticeProgress(queueLegalNotice(request, version, principal.name, reason)));
  });
}
