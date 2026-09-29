import { CommandHandler } from "@zudojs/cqrs";

import type { PaymentsService } from "../../services/payments.service.js";
import type { WebhookOutcome } from "../../services/payments.service.js";
import type { HandlePaymentWebhookCommand } from "./handlePaymentWebhook.command.js";

export class HandlePaymentWebhookHandler extends CommandHandler<HandlePaymentWebhookCommand, WebhookOutcome> {
  public readonly commandType = "payments.handlePaymentWebhook" as const;

  public constructor(private readonly service: PaymentsService) {
    super();
  }

  public execute(command: HandlePaymentWebhookCommand): Promise<WebhookOutcome> {
    return this.service.handleVerifiedWebhook(command.provider, command.rawBody);
  }
}
