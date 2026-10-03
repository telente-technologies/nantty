import { bulkBatchJobType } from "../../../../constants/delivery.constant.js";
import type { CampaignRepository } from "../../../../interfaces/campaignRepository.interface.js";
import type { IdentityDirectory } from "../../../../interfaces/identityDirectory.interface.js";
import type { JobQueue } from "../../../../interfaces/jobQueue.interface.js";
import type { Campaign, PolicyNoticePayload } from "../../../../types/campaign.type.js";
import type { Recipient } from "../../../../types/notification.type.js";
import type { EmailDeliveryService } from "../../../delivery/services/emailDelivery.service.js";
import { renderAdminMessage } from "../../services/adminMessageRenderer.service.js";
import type { ProcessBulkBatchCommand } from "./processBulkBatch.command.js";

export class ProcessBulkBatchHandler {
  public constructor(
    private readonly deps: {
      readonly campaigns: CampaignRepository;
      readonly identity: IdentityDirectory;
      readonly emailDelivery: EmailDeliveryService;
      readonly jobQueue: JobQueue;
      readonly jobsQueueUrl: string;
      readonly pause: (milliseconds: number) => Promise<void>;
      readonly now?: () => Date;
    },
  ) {}

  public async execute(command: ProcessBulkBatchCommand): Promise<{ readonly processed: boolean }> {
    const campaign = await this.deps.campaigns.findById(command.campaignId);
    if (campaign === null || campaign.status === "COMPLETED") return { processed: false };
    if (campaign.batchesDone !== command.batchIndex) {
      await this.requeueNextBatchIfLost(campaign, command);
      return { processed: false };
    }
    const page = await this.readAudiencePage(campaign, command.cursor);
    let sentCount = 0;
    let failedCount = 0;
    for (const recipient of page.recipients) {
      try {
        if (await this.deliverToRecipient(campaign, recipient)) sentCount += 1;
      } catch {
        failedCount += 1;
      }
      await this.deps.pause(1000 / campaign.ratePerSecond);
    }
    const completedAt = page.nextCursor === null ? (this.deps.now ?? (() => new Date()))() : null;
    const applied = await this.deps.campaigns.applyBatchProgress(campaign.id, command.batchIndex, { sentCount, failedCount, nextCursor: page.nextCursor }, completedAt);
    if (applied && page.nextCursor !== null) await this.enqueueBatch(campaign.id, command.batchIndex + 1, page.nextCursor);
    return { processed: applied };
  }

  private async readAudiencePage(campaign: Campaign, cursor: string | null): Promise<{ readonly recipients: readonly Recipient[]; readonly nextCursor: string | null }> {
    if (campaign.audienceKind === "USER") {
      const recipient = await this.deps.identity.getRecipient(campaign.audienceRef);
      return { recipients: recipient === null ? [] : [recipient], nextCursor: null };
    }
    const page = await this.deps.identity.listAudiencePage(campaign.audienceRef, cursor, campaign.batchSize);
    return { recipients: page.data, nextCursor: page.nextCursor };
  }

  private async deliverToRecipient(campaign: Campaign, recipient: Recipient): Promise<boolean> {
    const base = { dedupeKey: `bulk:${campaign.id}:${recipient.accountId}`, eventId: `bulk:${campaign.id}`, recipient };
    const outcome = campaign.kind === "POLICY_NOTICE"
      ? await this.deps.emailDelivery.deliver({ ...base, preferenceCategory: "privacy", templateKey: "policyUpdated", props: { firstName: recipient.firstName, ...(campaign.payload as PolicyNoticePayload) } })
      : await this.deps.emailDelivery.deliverCustom({
        ...base, preferenceCategory: campaign.mailKind === "marketing" ? "marketing" : "support", mailKind: campaign.mailKind,
        render: (unsubscribeUrl) => renderAdminMessage({ subject: campaign.subject, body: (campaign.payload as { body: string }).body, firstName: recipient.firstName, marketing: campaign.mailKind === "marketing", unsubscribeUrl, ...(this.deps.emailDelivery.brand === undefined ? {} : { brand: this.deps.emailDelivery.brand }) }),
      });
    return outcome.status === "sent" || (outcome.status === "duplicate" && outcome.previous === "sent");
  }

  private async requeueNextBatchIfLost(campaign: Campaign, command: ProcessBulkBatchCommand): Promise<void> {
    if (campaign.batchesDone === command.batchIndex + 1 && campaign.nextCursor !== null) await this.enqueueBatch(campaign.id, campaign.batchesDone, campaign.nextCursor);
  }

  private enqueueBatch(campaignId: string, batchIndex: number, cursor: string): Promise<void> {
    return this.deps.jobQueue.send(this.deps.jobsQueueUrl, { type: bulkBatchJobType, campaignId, batchIndex, cursor });
  }
}
