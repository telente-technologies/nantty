import { Command } from "@zudojs/cqrs";

import type { AdminSubscriptionAction } from "../../services/subscriptionLifecycle.service.js";
import type { Principal } from "../../../../interfaces/principal.interface.js";
import type { VerificationTier } from "../../../../interfaces/verificationBadge.interface.js";

export class ApplyAdminSubscriptionActionCommand extends Command<"subscriptions.applyAdminSubscriptionAction"> {
  public constructor(
    public readonly principal: Principal,
    public readonly profileId: string,
    public readonly action: AdminSubscriptionAction,
    public readonly plan: VerificationTier | undefined,
  ) {
    super("subscriptions.applyAdminSubscriptionAction");
  }
}
