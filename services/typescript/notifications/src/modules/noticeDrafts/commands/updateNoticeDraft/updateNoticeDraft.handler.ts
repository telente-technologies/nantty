import { notFoundError } from "../../../../errors/notifications.error.js";
import type { IdentityDirectory } from "../../../../interfaces/identityDirectory.interface.js";
import type { NoticeDraftRepository } from "../../../../interfaces/campaignRepository.interface.js";
import { convertNoticeDraftToResponse } from "../../../bulkCampaigns/dtos/campaign.dto.js";

export interface UpdateNoticeDraftCommand {
  readonly versionId: string;
  readonly subject: string;
  readonly summaryText: string;
  readonly whatChanged: readonly string[];
  readonly reacceptNote: string | null;
  readonly actor: { readonly id: string; readonly name: string };
}

export class UpdateNoticeDraftHandler {
  public constructor(private readonly drafts: NoticeDraftRepository, private readonly identity: IdentityDirectory) {}

  public async execute(command: UpdateNoticeDraftCommand) {
    const draft = await this.drafts.update(command.versionId, { subject: command.subject, summaryText: command.summaryText, whatChanged: command.whatChanged, reacceptNote: command.reacceptNote, updatedByName: command.actor.name });
    if (draft === null) throw notFoundError("Notice draft not found.");
    await this.identity.recordAdminAudit({ action: "legal_notice_draft.updated", actorId: command.actor.id, targetType: "legalVersion", targetId: command.versionId }).catch(() => undefined);
    return convertNoticeDraftToResponse(draft);
  }
}
