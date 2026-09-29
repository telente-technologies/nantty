import { CommandHandler } from "@zudojs/cqrs";

import type { OrderPaymentStatus, PaymentsService } from "../../services/payments.service.js";
import type { VerifyPaymentCommand } from "./verifyPayment.command.js";

export class VerifyPaymentHandler extends CommandHandler<VerifyPaymentCommand, OrderPaymentStatus> {
  public readonly commandType = "payments.verifyPayment" as const;

  public constructor(private readonly service: PaymentsService) {
    super();
  }

  public execute(command: VerifyPaymentCommand): Promise<OrderPaymentStatus> {
    return this.service.verifyOrderPaymentForBuyer(command.principal.userId, command.orderId);
  }
}
