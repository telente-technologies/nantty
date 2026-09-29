import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class RefundPaymentCommand extends Command<"payments.refundPayment"> {
  public constructor(
    public readonly principal: Principal,
    public readonly orderId: string,
  ) {
    super("payments.refundPayment");
  }
}
