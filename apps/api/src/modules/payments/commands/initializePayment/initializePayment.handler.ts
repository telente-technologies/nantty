import { CommandHandler } from "@zudojs/cqrs";

import type { InitializedOrderPayment } from "../../services/payments.service.js";
import type { PaymentsService } from "../../services/payments.service.js";
import type { InitializePaymentCommand } from "./initializePayment.command.js";

export class InitializePaymentHandler extends CommandHandler<InitializePaymentCommand, InitializedOrderPayment> {
  public readonly commandType = "payments.initializePayment" as const;

  public constructor(private readonly service: PaymentsService) {
    super();
  }

  public execute(command: InitializePaymentCommand): Promise<InitializedOrderPayment> {
    return this.service.initializeOrderPayment(command.principal.userId, command.orderId, command.provider);
  }
}
