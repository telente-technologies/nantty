import { sendAdminApiRequest } from "@/services/adminApiClient.service";
import type { LegalAcceptanceStats, LegalDocumentDetail, LegalDocumentSummary, LegalNoticeDraft, LegalNoticeDraftInput, LegalNoticePreview, LegalNoticeProgress, LegalVersion, LegalVersionInput, PublishLegalVersionInput } from "@/types/legal.type";

const documentPath = (documentKey: string, suffix = "") => `/admin/legal/documents/${encodeURIComponent(documentKey)}${suffix}`;
const versionPath = (versionId: string, suffix = "") => `/admin/legal/versions/${encodeURIComponent(versionId)}${suffix}`;

export function fetchLegalDocuments(signal?: AbortSignal): Promise<{ items: LegalDocumentSummary[] }> {
  return sendAdminApiRequest("/admin/legal/documents", { signal });
}

export function fetchLegalDocumentDetail(documentKey: string, signal?: AbortSignal): Promise<LegalDocumentDetail> {
  return sendAdminApiRequest(documentPath(documentKey), { signal });
}

export function createLegalVersionDraft(documentKey: string, input: LegalVersionInput): Promise<LegalVersion> {
  return sendAdminApiRequest(documentPath(documentKey, "/versions"), { method: "POST", body: input });
}

export function rollbackLegalDocument(documentKey: string, input: { fromVersionId: string; reason: string }): Promise<LegalVersion> {
  return sendAdminApiRequest(documentPath(documentKey, "/rollback"), { method: "POST", body: input });
}

export function updateLegalVersionDraft(versionId: string, input: LegalVersionInput): Promise<LegalVersion> {
  return sendAdminApiRequest(versionPath(versionId), { method: "PUT", body: input });
}

export function submitLegalVersionForReview(versionId: string): Promise<LegalVersion> {
  return sendAdminApiRequest(versionPath(versionId, "/submit"), { method: "POST", body: {} });
}

export function returnLegalVersionToDraft(versionId: string, reason: string): Promise<LegalVersion> {
  return sendAdminApiRequest(versionPath(versionId, "/return"), { method: "POST", body: { reason } });
}

export function publishLegalVersion(versionId: string, input: PublishLegalVersionInput): Promise<{ version: LegalVersion; noticeId: string | null }> {
  return sendAdminApiRequest(versionPath(versionId, "/publish"), { method: "POST", body: input });
}

export function fetchLegalNoticePreview(versionId: string, signal?: AbortSignal): Promise<LegalNoticePreview> {
  return sendAdminApiRequest(versionPath(versionId, "/notice-preview"), { signal });
}

export function fetchLegalAcceptanceStats(versionId: string, signal?: AbortSignal): Promise<LegalAcceptanceStats> {
  return sendAdminApiRequest(versionPath(versionId, "/acceptance"), { signal });
}

export function fetchLegalNotices(signal?: AbortSignal): Promise<{ items: LegalNoticeProgress[] }> {
  return sendAdminApiRequest("/admin/legal/notices", { signal });
}

export function sendLegalNotice(input: { versionId: string; reason: string }): Promise<LegalNoticeProgress> {
  return sendAdminApiRequest("/admin/legal/notices", { method: "POST", body: input });
}

export function fetchLegalNoticeDraft(versionId: string, signal?: AbortSignal): Promise<LegalNoticeDraft> {
  return sendAdminApiRequest(versionPath(versionId, "/notice-draft"), { signal });
}

export function saveLegalNoticeDraft(versionId: string, input: LegalNoticeDraftInput): Promise<LegalNoticeDraft> {
  return sendAdminApiRequest(versionPath(versionId, "/notice-draft"), { method: "PUT", body: input });
}

export function sendLegalNoticeTestToMyself(versionId: string): Promise<LegalNoticeDraft> {
  return sendAdminApiRequest(versionPath(versionId, "/notice-draft/test-send"), { method: "POST", body: {} });
}
