import { Query } from "@zudojs/cqrs";

import type { FollowTargetType } from "../../models/follows.model.js";

export class GetFollowStatusQuery extends Query<"follows.getFollowStatus"> {
  public constructor(
    public readonly viewerId: string | undefined,
    public readonly targetType: FollowTargetType,
    public readonly targetId: string,
  ) {
    super("follows.getFollowStatus");
  }
}
