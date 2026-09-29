import { CommandHandler } from "@zudojs/cqrs";

import type { PlanRecord } from "../../models/subscriptions.model.js";
import type { SubscriptionPlansService } from "../../services/subscriptionPlans.service.js";
import type { ReplaceSubscriptionPlanEntitlementsCommand } from "./replaceSubscriptionPlanEntitlements.command.js";

export class ReplaceSubscriptionPlanEntitlementsHandler extends CommandHandler<ReplaceSubscriptionPlanEntitlementsCommand, PlanRecord> {
  public readonly commandType = "subscriptions.replaceSubscriptionPlanEntitlements" as const;

  public constructor(private readonly service: SubscriptionPlansService) {
    super();
  }

  public execute(command: ReplaceSubscriptionPlanEntitlementsCommand): Promise<PlanRecord> {
    return this.service.replaceEntitlements(command.principal.userId, command.planId, command.entitlements);
  }
}
