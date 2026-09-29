import { Query } from "@zudojs/cqrs";

import type { VerificationColor } from "../../../../interfaces/verificationBadge.interface.js";

export class ListSubscriptionPlansQuery extends Query<"subscriptions.listSubscriptionPlans"> {
  public constructor(
    public readonly color: VerificationColor,
  ) {
    super("subscriptions.listSubscriptionPlans");
  }
}
