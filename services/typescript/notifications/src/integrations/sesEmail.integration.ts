import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

import type { EmailSender, OutgoingEmail } from "../interfaces/emailSender.interface.js";

export interface SesEmailSenderOptions {
  readonly region: string;
  readonly endpoint: string | undefined;
  readonly fromAddress: string;
  readonly configurationSet: string;
}

export class SesEmailSender implements EmailSender {
  private readonly client: SESv2Client;

  public constructor(private readonly options: SesEmailSenderOptions) {
    this.client = new SESv2Client({ region: options.region, ...(options.endpoint === undefined ? {} : { endpoint: options.endpoint }) });
  }

  public async send(email: OutgoingEmail): Promise<{ readonly messageId: string }> {
    const result = await this.client.send(new SendEmailCommand({
      FromEmailAddress: email.from ?? this.options.fromAddress,
      Destination: { ToAddresses: [email.to] },
      ...(email.replyTo === undefined ? {} : { ReplyToAddresses: [email.replyTo] }),
      ConfigurationSetName: this.options.configurationSet,
      EmailTags: Object.entries(email.tags ?? {}).map(([Name, Value]) => ({ Name, Value })),
      Content: {
        Simple: {
          Subject: { Data: email.subject, Charset: "UTF-8" },
          Body: { Html: { Data: email.html, Charset: "UTF-8" }, Text: { Data: email.text, Charset: "UTF-8" } },
          Headers: Object.entries(email.headers ?? {}).map(([Name, Value]) => ({ Name, Value })),
        },
      },
    }));
    if (result.MessageId === undefined) throw new Error("SES did not return a message id.");
    return { messageId: result.MessageId };
  }
}
