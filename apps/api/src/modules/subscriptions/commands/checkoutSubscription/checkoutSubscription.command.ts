import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";
import type { SubscriptionCheckoutRequest } from "../../services/subscriptionBilling.service.js";

export class CheckoutSubscriptionCommand extends Command<"subscriptions.checkoutSubscription"> {
  public constructor(
    public readonly principal: Principal,
    public readonly request: SubscriptionCheckoutRequest,
  ) {
    super("subscriptions.checkoutSubscription");
  }
}
