import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class RemovePayoutAccountCommand extends Command<"wallets.removePayoutAccount"> {
  public constructor(
    public readonly principal: Principal,
    public readonly storeId: string | undefined,
    public readonly payoutAccountId: string,
  ) {
    super("wallets.removePayoutAccount");
  }
}
