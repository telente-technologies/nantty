import { bulkBatchJobType } from "../../../../constants/delivery.constant.js";
import { ApiError } from "../../../../errors/notifications.error.js";
import type { CampaignRepository, NoticeDraftRepository } from "../../../../interfaces/campaignRepository.interface.js";
import type { IdentityDirectory } from "../../../../interfaces/identityDirectory.interface.js";
import type { JobQueue } from "../../../../interfaces/jobQueue.interface.js";
import type { PolicyNoticePayload } from "../../../../types/campaign.type.js";
import { convertCampaignToNoticeProgress } from "../../dtos/campaign.dto.js";
import { everyoneSegmentId, type LegalAudienceService } from "../../services/legalAudience.service.js";
import type { QueueLegalNoticeCommand } from "./queueLegalNotice.command.js";

export class QueueLegalNoticeHandler {
  public constructor(
    private readonly deps: {
      readonly drafts: NoticeDraftRepository;
      readonly campaigns: CampaignRepository;
      readonly audience: LegalAudienceService;
      readonly jobQueue: JobQueue;
      readonly jobsQueueUrl: string;
      readonly identity: IdentityDirectory;
      readonly batchSize: number;
      readonly ratePerSecond: number;
      readonly acceptUrl: string;
    },
  ) {}

  public async execute(command: QueueLegalNoticeCommand) {
    const draft = await this.deps.drafts.find(command.versionId);
    if (draft === null) throw new ApiError(409, "NOT_PUBLISHED", "Only a published version can be sent.");
    if ((await this.deps.campaigns.findActiveForVersion(command.versionId)) !== null) throw new ApiError(409, "NOTICE_IN_PROGRESS", "A notice for this version is already being sent.");
    const estimate = await this.deps.audience.estimate();
    const payload: PolicyNoticePayload = {
      policyName: draft.documentTitle, subjectLine: draft.subject, summary: draft.summaryText, changes: draft.whatChanged, effectiveAt: draft.effectiveAt.toISOString(),
      requiresReacceptance: draft.requiresReacceptance, policyUrl: draft.documentUrl, ...(draft.requiresReacceptance ? { acceptUrl: this.deps.acceptUrl } : {}),
      ...(draft.reacceptNote === null ? {} : { reacceptNote: draft.reacceptNote }),
    };
    const campaign = await this.deps.campaigns.create({
      kind: "POLICY_NOTICE", subject: draft.subject, payload, audienceKind: "SEGMENT", audienceRef: everyoneSegmentId, audienceLabel: "All users", mailKind: "legal",
      recipientCount: estimate.recipientCount, skippedNoMarketingConsent: 0, skippedHardBounces: estimate.excludedHardBounces, skippedSuppressed: estimate.excludedSuppressed,
      batchSize: this.deps.batchSize, ratePerSecond: this.deps.ratePerSecond, batchesTotal: estimate.batchesTotal, reason: command.reason, queuedById: command.actor.id, queuedByName: command.actor.name, versionId: command.versionId,
    });
    await this.deps.jobQueue.send(this.deps.jobsQueueUrl, { type: bulkBatchJobType, campaignId: campaign.id, batchIndex: 0, cursor: null });
    await this.deps.identity.recordAdminAudit({ action: "legal_notice.queued", actorId: command.actor.id, targetType: "legalVersion", targetId: command.versionId, reason: command.reason, detail: { campaignId: campaign.id, recipientCount: estimate.recipientCount } }).catch(() => undefined);
    return convertCampaignToNoticeProgress(campaign, draft);
  }
}
