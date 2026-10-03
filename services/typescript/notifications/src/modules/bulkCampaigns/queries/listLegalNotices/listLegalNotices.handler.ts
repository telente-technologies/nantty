import { notFoundError } from "../../../../errors/notifications.error.js";
import type { CampaignRepository, NoticeDraftRepository } from "../../../../interfaces/campaignRepository.interface.js";
import { convertCampaignToNoticeProgress } from "../../dtos/campaign.dto.js";

export class ListLegalNoticesHandler {
  public constructor(private readonly campaigns: CampaignRepository, private readonly drafts: NoticeDraftRepository) {}

  public async list() {
    const rows = await this.campaigns.list("POLICY_NOTICE", 50);
    const data = await Promise.all(rows.map(async (campaign) => convertCampaignToNoticeProgress(campaign, campaign.versionId === null ? null : await this.drafts.find(campaign.versionId))));
    return { data, nextCursor: null };
  }

  public async get(id: string) {
    const campaign = await this.campaigns.findById(id);
    if (campaign === null || campaign.kind !== "POLICY_NOTICE") throw notFoundError("Notice not found.");
    return convertCampaignToNoticeProgress(campaign, campaign.versionId === null ? null : await this.drafts.find(campaign.versionId));
  }
}
