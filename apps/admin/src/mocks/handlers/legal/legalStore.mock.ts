import { legalDocumentDefinitions, mockHardBouncedAddresses, mockSuppressedAddresses, sesBatchSize, sesRatePerSecond, mockSendSpeedMultiplier, totalMockRegisteredUsers } from "@/constants/legalDocuments.constant";
import { readMockAreaStore } from "@/mocks/mockDatabase.mock";
import { failNotFound } from "@/mocks/mockResponses.mock";
import { buildDemoLegalVersions, type MutableLegalVersion } from "@/mocks/seed/legalDocuments.mock";
import type { LegalDocumentKey, LegalDocumentSummary, LegalNoticeDraft, LegalNoticeProgress, LegalNoticeStatus } from "@/types/legal.type";

export interface LegalNoticeRecord {
  readonly id: string;
  readonly documentKey: LegalDocumentKey;
  readonly versionId: string;
  readonly versionNumber: number;
  readonly queuedAtEpochMs: number;
  readonly queuedByName: string;
}

interface LegalStore {
  readonly versions: MutableLegalVersion[];
  readonly notices: LegalNoticeRecord[];
  readonly noticeDrafts: Map<string, LegalNoticeDraft>;
}

const dayMilliseconds = 86_400_000;

function buildSeedNotices(versions: readonly MutableLegalVersion[]): LegalNoticeRecord[] {
  return versions.filter((version) => version.noticeId).map((version) => ({ id: version.noticeId ?? "", documentKey: version.documentKey, versionId: version.id, versionNumber: version.versionNumber, queuedAtEpochMs: Date.parse(version.publishedAt ?? "") + 60_000, queuedByName: version.publishedByName ?? "System" }));
}

export function readLegalStore(): LegalStore {
  return readMockAreaStore<LegalStore>("legal:store", () => {
    const versions = buildDemoLegalVersions();
    return { versions, notices: buildSeedNotices(versions), noticeDrafts: new Map() };
  });
}

export function readDocumentDefinitionOrFail(documentKey: string) {
  const definition = legalDocumentDefinitions.find((candidate) => candidate.key === documentKey);
  if (!definition) failNotFound("Legal document");
  return definition;
}

export function findVersionOrFail(versionId: string): MutableLegalVersion {
  const version = readLegalStore().versions.find((candidate) => candidate.id === versionId);
  if (!version) failNotFound("Legal document version");
  return version;
}

export function listVersionsOfDocument(documentKey: LegalDocumentKey): MutableLegalVersion[] {
  return readLegalStore().versions.filter((version) => version.documentKey === documentKey).sort((first, second) => second.versionNumber - first.versionNumber);
}

export function presentDocumentSummary(documentKey: LegalDocumentKey): LegalDocumentSummary {
  const definition = readDocumentDefinitionOrFail(documentKey);
  const versions = listVersionsOfDocument(documentKey);
  return { ...definition, currentVersion: versions.find((version) => version.status === "PUBLISHED") ?? null, openVersion: versions.find((version) => version.status === "DRAFT" || version.status === "IN_REVIEW") ?? null, versionCount: versions.length };
}

export function readSendableRecipientCount(): number {
  return totalMockRegisteredUsers - mockHardBouncedAddresses - mockSuppressedAddresses;
}

export function presentNoticeProgress(record: LegalNoticeRecord): LegalNoticeProgress {
  const recipientCount = readSendableRecipientCount();
  const elapsedSeconds = Math.max(0, (Date.now() - record.queuedAtEpochMs) / 1000);
  const sentCount = Math.min(recipientCount, Math.floor(elapsedSeconds * sesRatePerSecond * mockSendSpeedMultiplier));
  const batchesTotal = Math.ceil(recipientCount / sesBatchSize);
  const status: LegalNoticeStatus = sentCount >= recipientCount ? "COMPLETED" : sentCount === 0 ? "QUEUED" : "SENDING";
  const secondsLeft = (recipientCount - sentCount) / (sesRatePerSecond * mockSendSpeedMultiplier);
  const definition = readDocumentDefinitionOrFail(record.documentKey);
  return {
    id: record.id, documentKey: record.documentKey, documentTitle: definition.title, versionId: record.versionId, versionNumber: record.versionNumber,
    subject: readLegalStore().noticeDrafts.get(record.versionId)?.subject ?? `We've updated our ${definition.title}`, status, recipientCount, sentCount, excludedHardBounces: mockHardBouncedAddresses, excludedSuppressed: mockSuppressedAddresses,
    batchSize: sesBatchSize, ratePerSecond: sesRatePerSecond, batchesTotal, batchesDone: Math.floor(sentCount / sesBatchSize), queuedAt: new Date(record.queuedAtEpochMs).toISOString(),
    queuedByName: record.queuedByName, estimatedCompletionAt: status === "COMPLETED" ? null : new Date(Date.now() + secondsLeft * 1000).toISOString(), provider: "AWS_SES",
  };
}

export const thirtyDaysInMilliseconds = 30 * dayMilliseconds;
