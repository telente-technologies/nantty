import { CommandHandler } from "@zudojs/cqrs";

import type { SubscriptionBillingService } from "../../services/subscriptionBilling.service.js";
import type { SubscriptionCheckout } from "../../services/subscriptionBilling.service.js";
import type { CheckoutSubscriptionCommand } from "./checkoutSubscription.command.js";

export class CheckoutSubscriptionHandler extends CommandHandler<CheckoutSubscriptionCommand, SubscriptionCheckout> {
  public readonly commandType = "subscriptions.checkoutSubscription" as const;

  public constructor(private readonly service: SubscriptionBillingService) {
    super();
  }

  public execute(command: CheckoutSubscriptionCommand): Promise<SubscriptionCheckout> {
    return this.service.checkout(command.principal, command.request);
  }
}
