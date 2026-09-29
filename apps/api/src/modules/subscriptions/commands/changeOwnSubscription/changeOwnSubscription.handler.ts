import { CommandHandler } from "@zudojs/cqrs";

import type { SubscriptionBillingService } from "../../services/subscriptionBilling.service.js";
import type { SubscriptionRecord } from "../../models/subscriptions.model.js";
import type { ChangeOwnSubscriptionCommand } from "./changeOwnSubscription.command.js";

export class ChangeOwnSubscriptionHandler extends CommandHandler<ChangeOwnSubscriptionCommand, SubscriptionRecord> {
  public readonly commandType = "subscriptions.changeOwnSubscription" as const;

  public constructor(private readonly service: SubscriptionBillingService) {
    super();
  }

  public execute(command: ChangeOwnSubscriptionCommand): Promise<SubscriptionRecord> {
    return this.service.changeOwnSubscription(command.principal, command.profileId, command.change);
  }
}
