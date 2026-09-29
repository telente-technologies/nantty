import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class ProcessWithdrawalCommand extends Command<"wallets.processWithdrawal"> {
  public constructor(
    public readonly principal: Principal,
    public readonly withdrawalId: string,
  ) {
    super("wallets.processWithdrawal");
  }
}
