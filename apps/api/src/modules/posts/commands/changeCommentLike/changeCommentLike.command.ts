import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class ChangeCommentLikeCommand extends Command<"posts.changeCommentLike"> {
  public constructor(
    public readonly principal: Principal,
    public readonly commentId: string,
    public readonly liked: boolean,
  ) {
    super("posts.changeCommentLike");
  }
}
