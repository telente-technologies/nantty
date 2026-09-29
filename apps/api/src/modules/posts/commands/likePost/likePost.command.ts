import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class LikePostCommand extends Command<"posts.likePost"> {
  public constructor(
    public readonly principal: Principal,
    public readonly postId: string,
  ) {
    super("posts.likePost");
  }
}
