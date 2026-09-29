import { BaseModule, type ModuleContext } from "@zudojs/core";
import type { CommandBus, QueryBus } from "@zudojs/cqrs";

import { registerCommandHandlers, registerQueryHandlers } from "../../utils/cqrs.util.js";
import type { EscrowsService } from "../escrows/services/escrows.service.js";
import { HandlePaymentWebhookHandler } from "./commands/handlePaymentWebhook/handlePaymentWebhook.handler.js";
import { InitializePaymentHandler } from "./commands/initializePayment/initializePayment.handler.js";
import { RefundPaymentHandler } from "./commands/refundPayment/refundPayment.handler.js";
import { VerifyPaymentHandler } from "./commands/verifyPayment/verifyPayment.handler.js";
import { GetPaymentHandler } from "./queries/getPayment/getPayment.handler.js";
import { ListCheckoutPaymentsHandler } from "./queries/listCheckoutPayments/listCheckoutPayments.handler.js";
import type { PaymentsService } from "./services/payments.service.js";

export class PaymentsModule extends BaseModule {
  public readonly id = "payments";
  public readonly name = "payments";

  public constructor() {
    super({ version: "0.1.0" });
  }

  public override async onInitialize(context: ModuleContext): Promise<void> {
    context.logger.info("payments module initialized");
  }

  public override async onShutdown(context: ModuleContext): Promise<void> {
    context.logger.info("payments module stopped");
  }
}

export function registerPaymentsCommandAndQueryHandlers(commands: CommandBus, queries: QueryBus, paymentsService: PaymentsService, escrowsService: EscrowsService): void {
  registerCommandHandlers(commands, [
    new InitializePaymentHandler(paymentsService),
    new VerifyPaymentHandler(paymentsService),
    new HandlePaymentWebhookHandler(paymentsService),
    new RefundPaymentHandler(escrowsService),
  ]);
  registerQueryHandlers(queries, [new GetPaymentHandler(paymentsService), new ListCheckoutPaymentsHandler(paymentsService)]);
}
