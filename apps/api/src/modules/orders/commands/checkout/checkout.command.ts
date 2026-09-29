import { Command } from "@zudojs/cqrs";

import type { CurrencyCode } from "../../../../enums/currency.enum.js";
import type { Principal } from "../../../../interfaces/principal.interface.js";

export class CheckoutCommand extends Command<"orders.checkout"> {
  public constructor(
    public readonly principal: Principal,
    public readonly addressId: string,
    public readonly displayCurrency: CurrencyCode,
  ) {
    super("orders.checkout");
  }
}
