import { Query } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";
import type { ProfileType } from "../../../../interfaces/verificationBadge.interface.js";

export class GetMySubscriptionQuery extends Query<"subscriptions.getMySubscription"> {
  public constructor(
    public readonly principal: Principal,
    public readonly profileType: ProfileType,
    public readonly storeId: string | undefined,
  ) {
    super("subscriptions.getMySubscription");
  }
}
