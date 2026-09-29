import { CommandHandler } from "@zudojs/cqrs";

import type { CreatorSubscriptionRecord } from "../../models/creatorSubscriptions.model.js";
import type { CreatorSubscriptionsServices } from "../../services/creatorSubscriptionsServices.service.js";
import type { ResumeCreatorSubscriptionCommand } from "./resumeCreatorSubscription.command.js";

export class ResumeCreatorSubscriptionHandler extends CommandHandler<ResumeCreatorSubscriptionCommand, CreatorSubscriptionRecord> {
  public readonly commandType = "creatorSubscriptions.resumeCreatorSubscription" as const;

  public constructor(private readonly service: CreatorSubscriptionsServices) {
    super();
  }

  public execute(command: ResumeCreatorSubscriptionCommand): Promise<CreatorSubscriptionRecord> {
    return this.service.lifecycle.resumeSubscription(command.subscriberId, command.subscriptionId);
  }
}
