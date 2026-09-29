import { Query } from "@zudojs/cqrs";

import type { PageRequest } from "../../../../types/pagination.type.js";

export class ListLiveCommentsQuery extends Query<"posts.listLiveComments"> {
  public constructor(
    public readonly sessionId: string,
    public readonly page: PageRequest,
  ) {
    super("posts.listLiveComments");
  }
}
