import type { Campaign, NoticeDraft } from "../../../types/campaign.type.js";
import { estimateCompletionAt } from "../services/batchPlan.service.js";

export function convertCampaignToEmailSendRecord(campaign: Campaign) {
  return {
    id: campaign.id,
    kind: campaign.mailKind === "marketing" ? "MARKETING" : "TRANSACTIONAL",
    subject: campaign.subject,
    audienceLabel: campaign.audienceLabel,
    recipientCount: campaign.recipientCount,
    skippedNoMarketingConsent: campaign.skippedNoMarketingConsent,
    sentByName: campaign.queuedByName,
    sentAt: campaign.createdAt.toISOString(),
    provider: "AWS_SES" as const,
    status: campaign.status,
    sentCount: campaign.sentCount,
    failedCount: campaign.failedCount,
    batchesTotal: campaign.batchesTotal,
    batchesDone: campaign.batchesDone,
  };
}

export function convertCampaignToNoticeProgress(campaign: Campaign, draft: Pick<NoticeDraft, "documentKey" | "documentTitle" | "versionNumber"> | null) {
  return {
    id: campaign.id,
    documentKey: draft?.documentKey ?? "",
    documentTitle: draft?.documentTitle ?? "",
    versionId: campaign.versionId ?? "",
    versionNumber: draft?.versionNumber ?? 0,
    subject: campaign.subject,
    status: campaign.status,
    recipientCount: campaign.recipientCount,
    sentCount: campaign.sentCount,
    excludedHardBounces: campaign.skippedHardBounces,
    excludedSuppressed: campaign.skippedSuppressed,
    batchSize: campaign.batchSize,
    ratePerSecond: campaign.ratePerSecond,
    batchesTotal: campaign.batchesTotal,
    batchesDone: campaign.batchesDone,
    queuedAt: campaign.createdAt.toISOString(),
    queuedByName: campaign.queuedByName,
    estimatedCompletionAt: campaign.status === "COMPLETED" ? null : estimateCompletionAt(campaign.createdAt, campaign.recipientCount, campaign.ratePerSecond).toISOString(),
    provider: "AWS_SES" as const,
  };
}

export function convertNoticeDraftToResponse(draft: NoticeDraft) {
  return {
    versionId: draft.versionId,
    documentTitle: draft.documentTitle,
    subject: draft.subject,
    summaryText: draft.summaryText,
    whatChanged: draft.whatChanged,
    effectiveAt: draft.effectiveAt.toISOString(),
    reacceptNote: draft.reacceptNote,
    documentUrl: draft.documentUrl,
    updatedByName: draft.updatedByName,
    updatedAt: draft.updatedByName === null ? null : draft.updatedAt.toISOString(),
    testSends: draft.testSends,
  };
}
