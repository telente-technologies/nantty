import { randomUUID } from "node:crypto";

import type { Logger } from "@nantty/fastify-platform";

import type { EmailSender, OutgoingEmail } from "../interfaces/emailSender.interface.js";

export class LoggingEmailSender implements EmailSender {
  public constructor(private readonly logger: Logger) {}

  public async send(email: OutgoingEmail): Promise<{ readonly messageId: string }> {
    const messageId = `log-${randomUUID()}`;
    this.logger.info("email (log adapter)", { messageId, recipientDomain: email.to.split("@")[1] ?? "", subject: email.subject, template: email.tags?.["template"] ?? "" });
    return { messageId };
  }
}
