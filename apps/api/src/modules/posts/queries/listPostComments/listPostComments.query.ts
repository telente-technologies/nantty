import { Query } from "@zudojs/cqrs";

import type { PageRequest } from "../../../../types/pagination.type.js";

export class ListPostCommentsQuery extends Query<"posts.listPostComments"> {
  public constructor(
    public readonly viewerId: string | undefined,
    public readonly postId: string,
    public readonly page: PageRequest,
  ) {
    super("posts.listPostComments");
  }
}
