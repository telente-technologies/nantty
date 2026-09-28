import { Command } from "@zudojs/cqrs";

import type { FollowTargetType } from "../../models/follows.model.js";
import type { Principal } from "../../../../interfaces/principal.interface.js";

export class FollowCommand extends Command<"follows.follow"> {
  public constructor(
    public readonly principal: Principal,
    public readonly targetType: FollowTargetType,
    public readonly targetId: string,
  ) {
    super("follows.follow");
  }
}
