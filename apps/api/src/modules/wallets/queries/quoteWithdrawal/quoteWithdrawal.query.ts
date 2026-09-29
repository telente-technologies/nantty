import { Query } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";
import type { WalletScopeInput } from "../../models/wallets.model.js";

export class QuoteWithdrawalQuery extends Query<"wallets.quoteWithdrawal"> {
  public constructor(
    public readonly principal: Principal,
    public readonly scope: WalletScopeInput,
    public readonly amount: number,
    public readonly payoutAccountId: string,
  ) {
    super("wallets.quoteWithdrawal");
  }
}
