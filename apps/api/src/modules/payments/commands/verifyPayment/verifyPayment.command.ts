import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class VerifyPaymentCommand extends Command<"payments.verifyPayment"> {
  public constructor(
    public readonly principal: Principal,
    public readonly orderId: string,
  ) {
    super("payments.verifyPayment");
  }
}
