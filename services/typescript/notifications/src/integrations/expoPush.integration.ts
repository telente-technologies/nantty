import type { Logger } from "@nantty/fastify-platform";

import type { PushSender } from "../interfaces/pushSender.interface.js";
import type { PushContent } from "../types/notification.type.js";

export class LoggingPushSender implements PushSender {
  public constructor(private readonly logger: Logger) {}

  public async send(tokens: readonly string[], content: PushContent): Promise<void> {
    this.logger.info("push notification (log adapter)", { recipients: tokens.length, title: content.title });
  }

  public async sendSilent(tokens: readonly string[], data: Readonly<Record<string, unknown>>): Promise<void> {
    this.logger.info("silent push (log adapter)", { recipients: tokens.length, type: String(data["type"] ?? "") });
  }
}

export class ExpoPushSender implements PushSender {
  public async send(tokens: readonly string[], content: PushContent): Promise<void> {
    await postExpoMessages(tokens.map((to) => ({ to, title: content.title, body: content.body, data: content.data ?? {}, sound: "default" })));
  }

  public async sendSilent(tokens: readonly string[], data: Readonly<Record<string, unknown>>): Promise<void> {
    await postExpoMessages(tokens.map((to) => ({ to, data, _contentAvailable: true, priority: "normal" })));
  }
}

async function postExpoMessages(messages: readonly Record<string, unknown>[]): Promise<void> {
  for (let offset = 0; offset < messages.length; offset += 100) {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(messages.slice(offset, offset + 100)),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Expo push responded ${response.status}.`);
  }
}
