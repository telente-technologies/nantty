import { bulkBatchJobType } from "../../../../constants/delivery.constant.js";
import { validationError } from "../../../../errors/notifications.error.js";
import type { CampaignRepository } from "../../../../interfaces/campaignRepository.interface.js";
import type { IdentityDirectory } from "../../../../interfaces/identityDirectory.interface.js";
import type { JobQueue } from "../../../../interfaces/jobQueue.interface.js";
import { convertCampaignToEmailSendRecord } from "../../dtos/campaign.dto.js";
import type { AudiencePlannerService } from "../../services/audiencePlanner.service.js";
import { planBatches } from "../../services/batchPlan.service.js";
import type { QueueAdminEmailCommand } from "./queueAdminEmail.command.js";

export class QueueAdminEmailHandler {
  public constructor(
    private readonly deps: {
      readonly planner: AudiencePlannerService;
      readonly campaigns: CampaignRepository;
      readonly jobQueue: JobQueue;
      readonly jobsQueueUrl: string;
      readonly identity: IdentityDirectory;
      readonly batchSize: number;
      readonly ratePerSecond: number;
    },
  ) {}

  public async execute(command: QueueAdminEmailCommand) {
    const mailKind = command.kind === "MARKETING" ? "marketing" : "transactional";
    const plan = await this.deps.planner.plan(command.audience, mailKind);
    if (plan.eligibleCount === 0) throw validationError("No eligible recipients.");
    const campaign = await this.deps.campaigns.create({
      kind: "ADMIN_EMAIL", subject: command.subject, payload: { body: command.body }, audienceKind: plan.audienceKind, audienceRef: plan.audienceRef, audienceLabel: plan.audienceLabel,
      mailKind, recipientCount: plan.eligibleCount, skippedNoMarketingConsent: plan.skippedNoMarketingConsent, skippedHardBounces: 0, skippedSuppressed: 0,
      batchSize: this.deps.batchSize, ratePerSecond: this.deps.ratePerSecond, batchesTotal: planBatches(plan.totalCount, this.deps.batchSize, this.deps.ratePerSecond).batchesTotal,
      reason: command.reason, queuedById: command.actor.id, queuedByName: command.actor.name, versionId: null,
    });
    await this.deps.jobQueue.send(this.deps.jobsQueueUrl, { type: bulkBatchJobType, campaignId: campaign.id, batchIndex: 0, cursor: null });
    await this.deps.identity.recordAdminAudit({ action: "support.email_sent", actorId: command.actor.id, targetType: "emailCampaign", targetId: campaign.id, reason: command.reason, detail: { kind: command.kind, audience: plan.audienceLabel, recipientCount: plan.eligibleCount } }).catch(() => undefined);
    return convertCampaignToEmailSendRecord(campaign);
  }
}
