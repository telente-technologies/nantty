import { Command } from "@zudojs/cqrs";

import type { PlanPerk } from "../../models/subscriptions.model.js";
import type { Principal } from "../../../../interfaces/principal.interface.js";

export class ReplaceSubscriptionPlanPerksCommand extends Command<"subscriptions.replaceSubscriptionPlanPerks"> {
  public constructor(
    public readonly principal: Principal,
    public readonly planId: string,
    public readonly perks: readonly PlanPerk[],
  ) {
    super("subscriptions.replaceSubscriptionPlanPerks");
  }
}
