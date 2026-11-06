import type { Logger } from "@nantty/fastify-platform";

import type { PushProvider, PushProviderMode, PushSender, PushSendResult } from "../interfaces/pushSender.interface.js";
import type { PushContent } from "../types/notification.type.js";
import { disabledProviderResult } from "./expoPush.integration.js";

export class ProviderAwarePushSender implements PushSender {
  public constructor(
    private readonly mode: PushProviderMode,
    private readonly expo: PushSender,
    private readonly fcm: PushSender | null,
    private readonly logger: Logger,
  ) {}

  public async send(tokens: readonly string[], content: PushContent, provider: PushProvider = "expo"): Promise<PushSendResult> {
    if (this.mode === "log") {
      this.logger.info("push notification (log adapter)", { recipients: tokens.length, provider, title: content.title });
      return { acceptedCount: 0, failures: [], simulated: true };
    }
    if (!this.isEnabled(provider) || (provider === "fcm" && this.fcm === null)) return disabledProviderResult(tokens);
    return provider === "expo" ? this.expo.send(tokens, content) : this.fcm!.send(tokens, content);
  }

  public async sendSilent(tokens: readonly string[], data: Readonly<Record<string, unknown>>, provider: PushProvider = "expo"): Promise<PushSendResult> {
    if (this.mode === "log") {
      this.logger.info("silent push (log adapter)", { recipients: tokens.length, provider, type: String(data["type"] ?? "") });
      return { acceptedCount: 0, failures: [], simulated: true };
    }
    if (!this.isEnabled(provider) || (provider === "fcm" && this.fcm === null)) return disabledProviderResult(tokens);
    return provider === "expo" ? this.expo.sendSilent(tokens, data) : this.fcm!.sendSilent(tokens, data);
  }

  private isEnabled(provider: PushProvider): boolean {
    return this.mode === "multi" || this.mode === provider;
  }
}
