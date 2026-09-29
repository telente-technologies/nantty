import { CommandHandler } from "@zudojs/cqrs";

import type { CreatorSubscriptionCheckout } from "../../services/creatorSubscriptionBilling.service.js";
import type { CreatorSubscriptionsServices } from "../../services/creatorSubscriptionsServices.service.js";
import type { StartCreatorSubscriptionCommand } from "./startCreatorSubscription.command.js";

export class StartCreatorSubscriptionHandler extends CommandHandler<StartCreatorSubscriptionCommand, CreatorSubscriptionCheckout> {
  public readonly commandType = "creatorSubscriptions.startCreatorSubscription" as const;

  public constructor(private readonly service: CreatorSubscriptionsServices) {
    super();
  }

  public execute(command: StartCreatorSubscriptionCommand): Promise<CreatorSubscriptionCheckout> {
    return this.service.billing.startSubscription(command.request);
  }
}
