import { Query } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class GetMeQuery extends Query<"users.getMe"> {
  public constructor(
    public readonly principal: Principal,
  ) {
    super("users.getMe");
  }
}
