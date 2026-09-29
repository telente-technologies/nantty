import { Query } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class ListAdAccountsQuery extends Query<"ads.listAdAccounts"> {
  public constructor(
    public readonly principal: Principal,
  ) {
    super("ads.listAdAccounts");
  }
}
