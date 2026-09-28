import { Query } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class ListMyTopicsQuery extends Query<"users.listMyTopics"> {
  public constructor(
    public readonly principal: Principal,
  ) {
    super("users.listMyTopics");
  }
}
