import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class CommentOnLiveSessionCommand extends Command<"posts.commentOnLiveSession"> {
  public constructor(
    public readonly principal: Principal,
    public readonly sessionId: string,
    public readonly text: string,
  ) {
    super("posts.commentOnLiveSession");
  }
}
