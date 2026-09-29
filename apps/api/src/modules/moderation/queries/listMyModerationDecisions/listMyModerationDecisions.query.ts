import { Query } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class ListMyModerationDecisionsQuery extends Query<"moderation.listMyModerationDecisions"> {
  public constructor(
    public readonly principal: Principal,
  ) {
    super("moderation.listMyModerationDecisions");
  }
}
