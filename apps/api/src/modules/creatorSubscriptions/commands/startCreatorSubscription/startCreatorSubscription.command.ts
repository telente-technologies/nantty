import { Command } from "@zudojs/cqrs";

import type { StartCreatorSubscriptionRequest } from "../../services/creatorSubscriptionBilling.service.js";

export class StartCreatorSubscriptionCommand extends Command<"creatorSubscriptions.startCreatorSubscription"> {
  public constructor(
    public readonly request: StartCreatorSubscriptionRequest,
  ) {
    super("creatorSubscriptions.startCreatorSubscription");
  }
}
