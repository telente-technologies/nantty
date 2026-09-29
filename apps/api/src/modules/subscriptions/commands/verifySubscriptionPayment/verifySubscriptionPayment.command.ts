import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class VerifySubscriptionPaymentCommand extends Command<"subscriptions.verifySubscriptionPayment"> {
  public constructor(
    public readonly principal: Principal,
    public readonly reference: string,
  ) {
    super("subscriptions.verifySubscriptionPayment");
  }
}
