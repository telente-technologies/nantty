import { notFoundError } from "../../../../errors/notifications.error.js";
import type { NoticeDraftRepository } from "../../../../interfaces/campaignRepository.interface.js";
import { convertNoticeDraftToResponse } from "../../dtos/campaign.dto.js";
import type { LegalAudienceService } from "../../services/legalAudience.service.js";

export class PreviewLegalNoticeHandler {
  public constructor(private readonly drafts: NoticeDraftRepository, private readonly audience: LegalAudienceService, private readonly batchSize: number, private readonly ratePerSecond: number) {}

  public async execute(versionId: string) {
    const draft = await this.drafts.find(versionId);
    if (draft === null) throw notFoundError("Notice draft not found.");
    const estimate = await this.audience.estimate();
    return {
      draft: convertNoticeDraftToResponse(draft), subject: draft.subject, totalUsers: estimate.totalUsers, excludedHardBounces: estimate.excludedHardBounces, excludedSuppressed: estimate.excludedSuppressed,
      recipientCount: estimate.recipientCount, batchSize: this.batchSize, ratePerSecond: this.ratePerSecond, batchesTotal: estimate.batchesTotal, estimatedMinutes: estimate.estimatedMinutes, sendsWithoutMarketingConsent: true as const,
    };
  }
}
