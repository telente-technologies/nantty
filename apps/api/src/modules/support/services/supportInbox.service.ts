import { email } from "../../../integrations/email.integration.js";
import type { SupportInbox, SupportInboxMessage } from "../../../interfaces/supportInbox.interface.js";

export interface SupportEmail {
  readonly to: readonly string[];
  readonly subject: string;
  readonly text: string;
}

export interface SupportEmailSender {
  sendSupportEmail(message: SupportEmail): Promise<void>;
}

export class IntegrationSupportEmailSender implements SupportEmailSender {
  public async sendSupportEmail(message: SupportEmail): Promise<void> {
    await email().send({ to: message.to, subject: message.subject, text: message.text });
  }
}

const TOPIC_LABELS: Readonly<Record<SupportInboxMessage["topic"], string>> = {
  support_ticket: "Support",
  contact: "Contact",
  legal: "Legal",
  copyright: "Copyright",
};

export class EmailSupportInbox implements SupportInbox {
  public constructor(private readonly sender: SupportEmailSender, private readonly recipients: readonly string[]) {}

  public async notifySupportTeam(message: SupportInboxMessage): Promise<void> {
    if (this.recipients.length === 0) return;
    const replyLine = message.replyTo === undefined ? "" : `\n\nReply to: ${message.replyTo}`;
    await this.sender.sendSupportEmail({
      to: this.recipients,
      subject: `[Zudomart ${TOPIC_LABELS[message.topic]}] ${message.subject}`.slice(0, 200),
      text: `${message.text}${replyLine}`,
    });
  }
}
