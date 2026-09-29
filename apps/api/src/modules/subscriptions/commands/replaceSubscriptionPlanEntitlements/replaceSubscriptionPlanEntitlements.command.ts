import { Command } from "@zudojs/cqrs";

import type { PlanEntitlement } from "../../models/subscriptions.model.js";
import type { Principal } from "../../../../interfaces/principal.interface.js";

export class ReplaceSubscriptionPlanEntitlementsCommand extends Command<"subscriptions.replaceSubscriptionPlanEntitlements"> {
  public constructor(
    public readonly principal: Principal,
    public readonly planId: string,
    public readonly entitlements: readonly PlanEntitlement[],
  ) {
    super("subscriptions.replaceSubscriptionPlanEntitlements");
  }
}
