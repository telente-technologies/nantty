import { Query } from "@zudojs/cqrs";

import type { FollowTargetType } from "../../models/follows.model.js";
import type { PageRequest } from "../../../../types/pagination.type.js";

export class ListFollowingQuery extends Query<"follows.listFollowing"> {
  public constructor(
    public readonly userId: string,
    public readonly targetType: FollowTargetType,
    public readonly page: PageRequest,
  ) {
    super("follows.listFollowing");
  }
}
