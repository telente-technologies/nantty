import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class ChangeOwnSubscriptionCommand extends Command<"subscriptions.changeOwnSubscription"> {
  public constructor(
    public readonly principal: Principal,
    public readonly profileId: string,
    public readonly change: "cancel" | "resume",
  ) {
    super("subscriptions.changeOwnSubscription");
  }
}
