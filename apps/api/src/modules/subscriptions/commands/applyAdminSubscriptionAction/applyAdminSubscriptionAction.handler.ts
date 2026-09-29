import { CommandHandler } from "@zudojs/cqrs";

import type { SubscriptionLifecycleService } from "../../services/subscriptionLifecycle.service.js";
import type { SubscriptionRecord } from "../../models/subscriptions.model.js";
import type { ApplyAdminSubscriptionActionCommand } from "./applyAdminSubscriptionAction.command.js";

export class ApplyAdminSubscriptionActionHandler extends CommandHandler<ApplyAdminSubscriptionActionCommand, SubscriptionRecord> {
  public readonly commandType = "subscriptions.applyAdminSubscriptionAction" as const;

  public constructor(private readonly service: SubscriptionLifecycleService) {
    super();
  }

  public execute(command: ApplyAdminSubscriptionActionCommand): Promise<SubscriptionRecord> {
    return this.service.applyAdminAction(command.principal.userId, command.profileId, command.action, command.plan);
  }
}
