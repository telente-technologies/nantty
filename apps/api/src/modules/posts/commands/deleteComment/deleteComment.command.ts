import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class DeleteCommentCommand extends Command<"posts.deleteComment"> {
  public constructor(
    public readonly principal: Principal,
    public readonly commentId: string,
    public readonly expectedPostId: string | null = null,
  ) {
    super("posts.deleteComment");
  }
}
