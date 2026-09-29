import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class ReactToLiveSessionCommand extends Command<"posts.reactToLiveSession"> {
  public constructor(
    public readonly principal: Principal,
    public readonly sessionId: string,
    public readonly emoji: string,
  ) {
    super("posts.reactToLiveSession");
  }
}
