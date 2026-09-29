import { Query } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class ListPayoutAccountsQuery extends Query<"wallets.listPayoutAccounts"> {
  public constructor(
    public readonly principal: Principal,
    public readonly storeId: string | undefined,
  ) {
    super("wallets.listPayoutAccounts");
  }
}
