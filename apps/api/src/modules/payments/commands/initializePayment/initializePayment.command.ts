import { Command } from "@zudojs/cqrs";

import type { PaymentProvider } from "../../../../enums/paymentStatus.enum.js";
import type { Principal } from "../../../../interfaces/principal.interface.js";

export class InitializePaymentCommand extends Command<"payments.initializePayment"> {
  public constructor(
    public readonly principal: Principal,
    public readonly orderId: string,
    public readonly provider: PaymentProvider,
  ) {
    super("payments.initializePayment");
  }
}
