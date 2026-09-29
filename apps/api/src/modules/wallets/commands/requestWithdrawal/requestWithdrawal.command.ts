import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class RequestWithdrawalCommand extends Command<"wallets.requestWithdrawal"> {
  public constructor(
    public readonly principal: Principal,
    public readonly storeId: string | undefined,
    public readonly amount: number,
    public readonly payoutAccountId: string,
  ) {
    super("wallets.requestWithdrawal");
  }
}
