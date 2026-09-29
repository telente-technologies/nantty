import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";
import type { WalletScopeInput } from "../../models/wallets.model.js";

export class RemovePayoutAccountCommand extends Command<"wallets.removePayoutAccount"> {
  public constructor(
    public readonly principal: Principal,
    public readonly scope: WalletScopeInput,
    public readonly payoutAccountId: string,
  ) {
    super("wallets.removePayoutAccount");
  }
}
