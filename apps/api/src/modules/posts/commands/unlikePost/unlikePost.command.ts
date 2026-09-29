import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class UnlikePostCommand extends Command<"posts.unlikePost"> {
  public constructor(
    public readonly principal: Principal,
    public readonly postId: string,
  ) {
    super("posts.unlikePost");
  }
}
