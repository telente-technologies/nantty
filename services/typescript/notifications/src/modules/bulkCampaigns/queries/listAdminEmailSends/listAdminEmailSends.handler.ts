import type { CampaignRepository } from "../../../../interfaces/campaignRepository.interface.js";
import { convertCampaignToEmailSendRecord } from "../../dtos/campaign.dto.js";

export class ListAdminEmailSendsHandler {
  public constructor(private readonly campaigns: CampaignRepository) {}

  public async execute() {
    return { data: (await this.campaigns.list("ADMIN_EMAIL", 50)).map(convertCampaignToEmailSendRecord), nextCursor: null };
  }
}
