import { Query } from "@zudojs/cqrs";

import type { PageRequest } from "../../../../types/pagination.type.js";
import type { Principal } from "../../../../interfaces/principal.interface.js";
import type { WalletScopeInput } from "../../models/wallets.model.js";

export class ListWalletTransactionsQuery extends Query<"wallets.listWalletTransactions"> {
  public constructor(
    public readonly principal: Principal,
    public readonly scope: WalletScopeInput,
    public readonly page: PageRequest,
  ) {
    super("wallets.listWalletTransactions");
  }
}
