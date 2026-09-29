import { Query } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class ListAdInvitesQuery extends Query<"ads.listAdInvites"> {
  public constructor(
    public readonly principal: Principal,
    public readonly accountId: string,
  ) {
    super("ads.listAdInvites");
  }
}
