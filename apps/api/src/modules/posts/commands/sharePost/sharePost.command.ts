import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class SharePostCommand extends Command<"posts.sharePost"> {
  public constructor(
    public readonly principal: Principal,
    public readonly postId: string,
  ) {
    super("posts.sharePost");
  }
}
