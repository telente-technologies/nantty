import { CommandHandler } from "@zudojs/cqrs";

import type { PlanRecord } from "../../models/subscriptions.model.js";
import type { SubscriptionPlansService } from "../../services/subscriptionPlans.service.js";
import type { UpdateSubscriptionPlanCommand } from "./updateSubscriptionPlan.command.js";

export class UpdateSubscriptionPlanHandler extends CommandHandler<UpdateSubscriptionPlanCommand, PlanRecord> {
  public readonly commandType = "subscriptions.updateSubscriptionPlan" as const;

  public constructor(private readonly service: SubscriptionPlansService) {
    super();
  }

  public execute(command: UpdateSubscriptionPlanCommand): Promise<PlanRecord> {
    return this.service.updatePlan(command.principal.userId, command.planId, command.changes);
  }
}
