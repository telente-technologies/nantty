import { CommandHandler } from "@zudojs/cqrs";

import type { PlanRecord } from "../../models/subscriptions.model.js";
import type { SubscriptionPlansService } from "../../services/subscriptionPlans.service.js";
import type { ReplaceSubscriptionPlanPricesCommand } from "./replaceSubscriptionPlanPrices.command.js";

export class ReplaceSubscriptionPlanPricesHandler extends CommandHandler<ReplaceSubscriptionPlanPricesCommand, PlanRecord> {
  public readonly commandType = "subscriptions.replaceSubscriptionPlanPrices" as const;

  public constructor(private readonly service: SubscriptionPlansService) {
    super();
  }

  public execute(command: ReplaceSubscriptionPlanPricesCommand): Promise<PlanRecord> {
    return this.service.replacePrices(command.principal.userId, command.planId, command.prices);
  }
}
