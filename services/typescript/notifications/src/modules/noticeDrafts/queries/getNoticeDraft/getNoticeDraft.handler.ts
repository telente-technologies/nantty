import { notFoundError } from "../../../../errors/notifications.error.js";
import type { NoticeDraftRepository } from "../../../../interfaces/campaignRepository.interface.js";
import { convertNoticeDraftToResponse } from "../../../bulkCampaigns/dtos/campaign.dto.js";

export class GetNoticeDraftHandler {
  public constructor(private readonly drafts: NoticeDraftRepository) {}

  public async execute(versionId: string) {
    const draft = await this.drafts.find(versionId);
    if (draft === null) throw notFoundError("Notice draft not found.");
    return convertNoticeDraftToResponse(draft);
  }
}
