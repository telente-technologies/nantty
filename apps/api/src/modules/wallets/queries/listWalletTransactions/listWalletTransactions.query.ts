import { Query } from "@zudojs/cqrs";

import type { PageRequest } from "../../../../types/pagination.type.js";
import type { Principal } from "../../../../interfaces/principal.interface.js";

export class ListWalletTransactionsQuery extends Query<"wallets.listWalletTransactions"> {
  public constructor(
    public readonly principal: Principal,
    public readonly storeId: string | undefined,
    public readonly page: PageRequest,
  ) {
    super("wallets.listWalletTransactions");
  }
}
