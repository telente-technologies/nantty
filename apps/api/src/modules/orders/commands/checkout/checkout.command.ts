import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";
import type { ShippingAddressInput } from "../../validators/orders.validator.js";

export class CheckoutCommand extends Command<"orders.checkout"> {
  public constructor(
    public readonly principal: Principal,
    public readonly shippingAddress: ShippingAddressInput,
  ) {
    super("orders.checkout");
  }
}
