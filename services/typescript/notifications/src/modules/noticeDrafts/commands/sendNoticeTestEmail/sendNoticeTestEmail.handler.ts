import { renderEmail } from "@nantty/email-templates";

import { ApiError, notFoundError } from "../../../../errors/notifications.error.js";
import type { NoticeDraftRepository } from "../../../../interfaces/campaignRepository.interface.js";
import type { EmailSender } from "../../../../interfaces/emailSender.interface.js";
import type { IdentityDirectory } from "../../../../interfaces/identityDirectory.interface.js";
import { convertNoticeDraftToResponse } from "../../../bulkCampaigns/dtos/campaign.dto.js";
import type { EmailBrandConfig } from "@nantty/email-templates";

export interface SendNoticeTestEmailCommand {
  readonly versionId: string;
  readonly actor: { readonly id: string; readonly name: string };
}

export class SendNoticeTestEmailHandler {
  public constructor(
    private readonly deps: { readonly drafts: NoticeDraftRepository; readonly identity: IdentityDirectory; readonly sender: EmailSender; readonly acceptUrl: string; readonly brand: EmailBrandConfig; readonly now?: () => Date },
  ) {}

  public async execute(command: SendNoticeTestEmailCommand) {
    const draft = await this.deps.drafts.find(command.versionId);
    if (draft === null) throw notFoundError("Notice draft not found.");
    const address = await this.deps.identity.getStaffEmail(command.actor.id);
    if (address === null) throw new ApiError(409, "NO_STAFF_EMAIL", "Your admin account has no email address on file.");
    const rendered = await renderEmail("policyUpdated", {
      firstName: command.actor.name.split(" ")[0] ?? "there", policyName: draft.documentTitle, subjectLine: draft.subject, summary: draft.summaryText, changes: draft.whatChanged, effectiveAt: draft.effectiveAt.toISOString(),
      requiresReacceptance: draft.requiresReacceptance, policyUrl: draft.documentUrl, ...(draft.requiresReacceptance ? { acceptUrl: this.deps.acceptUrl } : {}), ...(draft.reacceptNote === null ? {} : { reacceptNote: draft.reacceptNote }),
    }, { brand: this.deps.brand });
    await this.deps.sender.send({ to: address, subject: `[Test] ${rendered.subject}`, html: rendered.html, text: rendered.text, tags: { kind: "legal", template: "policyUpdated", test: "true" } });
    const updated = await this.deps.drafts.appendTestSend(command.versionId, { sentToEmail: address, sentByName: command.actor.name, sentAt: (this.deps.now ?? (() => new Date()))().toISOString() });
    await this.deps.identity.recordAdminAudit({ action: "legal_notice_draft.test_sent", actorId: command.actor.id, targetType: "legalVersion", targetId: command.versionId }).catch(() => undefined);
    return convertNoticeDraftToResponse(updated ?? draft);
  }
}
