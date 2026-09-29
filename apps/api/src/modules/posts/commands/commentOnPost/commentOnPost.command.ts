import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class CommentOnPostCommand extends Command<"posts.commentOnPost"> {
  public constructor(
    public readonly principal: Principal,
    public readonly postId: string,
    public readonly text: string,
    public readonly parentCommentId: string | null,
  ) {
    super("posts.commentOnPost");
  }
}
