import { Query } from "@zudojs/cqrs";

import type { PageRequest } from "../../../../types/pagination.type.js";

export class ListCommentRepliesQuery extends Query<"posts.listCommentReplies"> {
  public constructor(
    public readonly viewerId: string | undefined,
    public readonly commentId: string,
    public readonly page: PageRequest,
  ) {
    super("posts.listCommentReplies");
  }
}
