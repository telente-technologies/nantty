import { CommandHandler } from "@zudojs/cqrs";

import type { InitializedCheckoutPayment } from "../../services/payments.service.js";
import type { PaymentsService } from "../../services/payments.service.js";
import type { InitializePaymentCommand } from "./initializePayment.command.js";

export class InitializePaymentHandler extends CommandHandler<InitializePaymentCommand, InitializedCheckoutPayment> {
  public readonly commandType = "payments.initializePayment" as const;

  public constructor(private readonly service: PaymentsService) {
    super();
  }

  public execute(command: InitializePaymentCommand): Promise<InitializedCheckoutPayment> {
    return this.service.initializeCheckoutPayment(command.principal.userId, command.checkoutId, command.provider);
  }
}
