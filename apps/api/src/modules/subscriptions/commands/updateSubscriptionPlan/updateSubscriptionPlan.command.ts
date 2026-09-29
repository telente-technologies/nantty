import { Command } from "@zudojs/cqrs";

import type { PlanChanges } from "../../models/subscriptions.model.js";
import type { Principal } from "../../../../interfaces/principal.interface.js";

export class UpdateSubscriptionPlanCommand extends Command<"subscriptions.updateSubscriptionPlan"> {
  public constructor(
    public readonly principal: Principal,
    public readonly planId: string,
    public readonly changes: PlanChanges,
  ) {
    super("subscriptions.updateSubscriptionPlan");
  }
}
