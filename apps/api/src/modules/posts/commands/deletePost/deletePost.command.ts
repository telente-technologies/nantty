import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class DeletePostCommand extends Command<"posts.deletePost"> {
  public constructor(
    public readonly principal: Principal,
    public readonly postId: string,
  ) {
    super("posts.deletePost");
  }
}
