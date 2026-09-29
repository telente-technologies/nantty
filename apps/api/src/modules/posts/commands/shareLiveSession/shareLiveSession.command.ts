import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class ShareLiveSessionCommand extends Command<"posts.shareLiveSession"> {
  public constructor(
    public readonly principal: Principal,
    public readonly sessionId: string,
    public readonly recipientIds: readonly string[],
  ) {
    super("posts.shareLiveSession");
  }
}
