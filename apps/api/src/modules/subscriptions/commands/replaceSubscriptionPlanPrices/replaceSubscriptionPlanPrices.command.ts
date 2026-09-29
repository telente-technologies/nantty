import { Command } from "@zudojs/cqrs";

import type { PlanPrice } from "../../models/subscriptions.model.js";
import type { Principal } from "../../../../interfaces/principal.interface.js";

export class ReplaceSubscriptionPlanPricesCommand extends Command<"subscriptions.replaceSubscriptionPlanPrices"> {
  public constructor(
    public readonly principal: Principal,
    public readonly planId: string,
    public readonly prices: readonly PlanPrice[],
  ) {
    super("subscriptions.replaceSubscriptionPlanPrices");
  }
}
