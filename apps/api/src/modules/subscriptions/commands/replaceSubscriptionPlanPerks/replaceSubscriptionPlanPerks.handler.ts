import { CommandHandler } from "@zudojs/cqrs";

import type { PlanRecord } from "../../models/subscriptions.model.js";
import type { SubscriptionPlansService } from "../../services/subscriptionPlans.service.js";
import type { ReplaceSubscriptionPlanPerksCommand } from "./replaceSubscriptionPlanPerks.command.js";

export class ReplaceSubscriptionPlanPerksHandler extends CommandHandler<ReplaceSubscriptionPlanPerksCommand, PlanRecord> {
  public readonly commandType = "subscriptions.replaceSubscriptionPlanPerks" as const;

  public constructor(private readonly service: SubscriptionPlansService) {
    super();
  }

  public execute(command: ReplaceSubscriptionPlanPerksCommand): Promise<PlanRecord> {
    return this.service.replacePerks(command.principal.userId, command.planId, command.perks);
  }
}
