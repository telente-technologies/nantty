import type { Logger } from "@zudojs/logger";

import type { PushSender } from "../interfaces/pushSender.interface.js";
import type { PushContent } from "../types/notification.type.js";

export class LoggingPushSender implements PushSender {
  public constructor(private readonly logger: Logger) {}

  public async send(tokens: readonly string[], content: PushContent): Promise<void> {
    this.logger.info("push notification (log adapter)", { recipients: tokens.length, title: content.title });
  }
}

export class ExpoPushSender implements PushSender {
  public async send(tokens: readonly string[], content: PushContent): Promise<void> {
    const messages = tokens.map((to) => ({ to, title: content.title, body: content.body, data: content.data ?? {}, sound: "default" }));
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
}
