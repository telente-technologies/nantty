import type { EmailTemplateKey } from "@nantty/email-templates";

import { digestJobType } from "../../../../constants/delivery.constant.js";
import type { DigestKind, DigestSource } from "../../../../interfaces/digestSource.interface.js";
import type { IdentityDirectory } from "../../../../interfaces/identityDirectory.interface.js";
import type { JobQueue } from "../../../../interfaces/jobQueue.interface.js";
import type { PreferenceCategory } from "../../../../types/notification.type.js";
import type { EmailDeliveryService } from "../../../delivery/services/emailDelivery.service.js";
import type { RunDigestBatchCommand } from "./runDigestBatch.command.js";

const digestTemplates: Readonly<Record<DigestKind, { readonly templateKey: EmailTemplateKey; readonly category: PreferenceCategory }>> = {
  weekly: { templateKey: "weeklyDigest", category: "marketing" },
  followRequests: { templateKey: "followRequestDigest", category: "social" },
  messageRequests: { templateKey: "messageRequestDigest", category: "social" },
};

export class RunDigestBatchHandler {
  public constructor(private readonly deps: { readonly source: DigestSource; readonly identity: IdentityDirectory; readonly emailDelivery: EmailDeliveryService; readonly jobQueue: JobQueue; readonly jobsQueueUrl: string; readonly batchSize: number }) {}

  public async execute(command: RunDigestBatchCommand): Promise<{ readonly sent: number }> {
    const { templateKey, category } = digestTemplates[command.kind];
    const page = await this.deps.source.listPage(command.kind, command.cursor, this.deps.batchSize);
    let sent = 0;
    for (const entry of page.data) {
      const recipient = await this.deps.identity.getRecipient(entry.userId);
      if (recipient === null) continue;
      const outcome = await this.deps.emailDelivery.deliver({
        dedupeKey: `digest:${command.kind}:${command.periodKey}:${entry.userId}`, eventId: `digest:${command.kind}:${command.periodKey}`, recipient,
        preferenceCategory: category, templateKey, props: { ...entry.props, firstName: recipient.firstName },
      });
      if (outcome.status === "sent") sent += 1;
    }
    if (page.nextCursor !== null) await this.deps.jobQueue.send(this.deps.jobsQueueUrl, { type: digestJobType, kind: command.kind, periodKey: command.periodKey, cursor: page.nextCursor });
    return { sent };
  }
}
