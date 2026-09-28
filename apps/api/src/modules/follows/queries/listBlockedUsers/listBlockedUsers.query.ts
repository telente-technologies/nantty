import { Query } from "@zudojs/cqrs";

import type { PageRequest } from "../../../../types/pagination.type.js";
import type { Principal } from "../../../../interfaces/principal.interface.js";

export class ListBlockedUsersQuery extends Query<"follows.listBlockedUsers"> {
  public constructor(
    public readonly principal: Principal,
    public readonly page: PageRequest,
  ) {
    super("follows.listBlockedUsers");
  }
}
