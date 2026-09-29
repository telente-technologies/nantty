import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class ChangeChannelSubscriptionCommand extends Command<"messages.changeChannelSubscription"> {
  public constructor(
    public readonly principal: Principal,
    public readonly channelId: string,
    public readonly subscribe: boolean,
  ) {
    super("messages.changeChannelSubscription");
  }
}
