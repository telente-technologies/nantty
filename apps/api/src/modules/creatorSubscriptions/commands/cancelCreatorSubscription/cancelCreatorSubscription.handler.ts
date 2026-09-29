import { CommandHandler } from "@zudojs/cqrs";

import type { CreatorSubscriptionRecord } from "../../models/creatorSubscriptions.model.js";
import type { CreatorSubscriptionsServices } from "../../services/creatorSubscriptionsServices.service.js";
import type { CancelCreatorSubscriptionCommand } from "./cancelCreatorSubscription.command.js";

export class CancelCreatorSubscriptionHandler extends CommandHandler<CancelCreatorSubscriptionCommand, CreatorSubscriptionRecord> {
  public readonly commandType = "creatorSubscriptions.cancelCreatorSubscription" as const;

  public constructor(private readonly service: CreatorSubscriptionsServices) {
    super();
  }

  public execute(command: CancelCreatorSubscriptionCommand): Promise<CreatorSubscriptionRecord> {
    return this.service.lifecycle.cancelSubscription(command.subscriberId, command.subscriptionId);
  }
}
