import { Query } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class ListSessionsQuery extends Query<"auth.list-sessions"> {
  public constructor(
    public readonly principal: Principal,
  ) {
    super("auth.list-sessions");
  }
}
