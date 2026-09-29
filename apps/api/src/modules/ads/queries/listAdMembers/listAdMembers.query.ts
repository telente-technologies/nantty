import { Query } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class ListAdMembersQuery extends Query<"ads.listAdMembers"> {
  public constructor(
    public readonly principal: Principal,
    public readonly accountId: string,
  ) {
    super("ads.listAdMembers");
  }
}
