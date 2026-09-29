import { Query } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";
import type { WalletScopeInput } from "../../models/wallets.model.js";

export class ListPayoutAccountsQuery extends Query<"wallets.listPayoutAccounts"> {
  public constructor(
    public readonly principal: Principal,
    public readonly scope: WalletScopeInput,
  ) {
    super("wallets.listPayoutAccounts");
  }
}
