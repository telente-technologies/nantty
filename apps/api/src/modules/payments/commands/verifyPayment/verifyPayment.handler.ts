import { CommandHandler } from "@zudojs/cqrs";

import type { PaymentRecord } from "../../models/payments.model.js";
import type { PaymentsService } from "../../services/payments.service.js";
import type { VerifyPaymentCommand } from "./verifyPayment.command.js";

export class VerifyPaymentHandler extends CommandHandler<VerifyPaymentCommand, PaymentRecord> {
  public readonly commandType = "payments.verifyPayment" as const;

  public constructor(private readonly service: PaymentsService) {
    super();
  }

  public execute(command: VerifyPaymentCommand): Promise<PaymentRecord> {
    return this.service.verifyPaymentForBuyer(command.principal.userId, command.reference);
  }
}
