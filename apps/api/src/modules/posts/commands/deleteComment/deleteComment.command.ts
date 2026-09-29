import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class DeleteCommentCommand extends Command<"posts.deleteComment"> {
  public constructor(
    public readonly principal: Principal,
    public readonly postId: string,
    public readonly commentId: string,
  ) {
    super("posts.deleteComment");
  }
}
