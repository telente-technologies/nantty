import { Query } from "@zudojs/cqrs";

import type { FollowTargetType } from "../../models/follows.model.js";
import type { PageRequest } from "../../../../types/pagination.type.js";

export class ListFollowersQuery extends Query<"follows.listFollowers"> {
  public constructor(
    public readonly targetType: FollowTargetType,
    public readonly targetId: string,
    public readonly page: PageRequest,
  ) {
    super("follows.listFollowers");
  }
}
