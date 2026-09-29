import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class VerifyWalletTopUpCommand extends Command<"wallets.verifyWalletTopUp"> {
  public constructor(
    public readonly principal: Principal,
    public readonly reference: string,
  ) {
    super("wallets.verifyWalletTopUp");
  }
}
