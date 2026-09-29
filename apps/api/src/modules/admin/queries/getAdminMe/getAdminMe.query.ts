import { Query } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class GetAdminMeQuery extends Query<"admin.getAdminMe"> {
  public constructor(
    public readonly principal: Principal,
  ) {
    super("admin.getAdminMe");
  }
}
