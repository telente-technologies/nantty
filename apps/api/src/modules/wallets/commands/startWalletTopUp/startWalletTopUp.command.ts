import { Command } from "@zudojs/cqrs";

import type { CurrencyCode } from "../../../../enums/currency.enum.js";
import type { PaymentProvider } from "../../../../enums/paymentStatus.enum.js";
import type { Principal } from "../../../../interfaces/principal.interface.js";

export class StartWalletTopUpCommand extends Command<"wallets.startWalletTopUp"> {
  public constructor(
    public readonly principal: Principal,
    public readonly amount: number,
    public readonly currency: CurrencyCode,
    public readonly provider: PaymentProvider,
    public readonly returnTo: string | undefined,
  ) {
    super("wallets.startWalletTopUp");
  }
}
