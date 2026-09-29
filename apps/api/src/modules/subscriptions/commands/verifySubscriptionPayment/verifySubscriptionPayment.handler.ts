import { CommandHandler } from "@zudojs/cqrs";

import type { SubscriptionBillingService } from "../../services/subscriptionBilling.service.js";
import type { SubscriptionRecord } from "../../models/subscriptions.model.js";
import type { VerifySubscriptionPaymentCommand } from "./verifySubscriptionPayment.command.js";

export class VerifySubscriptionPaymentHandler extends CommandHandler<VerifySubscriptionPaymentCommand, SubscriptionRecord> {
  public readonly commandType = "subscriptions.verifySubscriptionPayment" as const;

  public constructor(private readonly service: SubscriptionBillingService) {
    super();
  }

  public execute(command: VerifySubscriptionPaymentCommand): Promise<SubscriptionRecord> {
    return this.service.verifyChargeForPayer(command.principal, command.reference);
  }
}
