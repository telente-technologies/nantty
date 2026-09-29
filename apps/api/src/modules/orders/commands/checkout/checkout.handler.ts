import { CommandHandler } from "@zudojs/cqrs";

import type { OrdersService } from "../../services/orders.service.js";
import type { CheckoutResult } from "../../services/orders.service.js";
import type { CheckoutCommand } from "./checkout.command.js";

export class CheckoutHandler extends CommandHandler<CheckoutCommand, CheckoutResult> {
  public readonly commandType = "orders.checkout" as const;

  public constructor(private readonly service: OrdersService) {
    super();
  }

  public execute(command: CheckoutCommand): Promise<CheckoutResult> {
    return this.service.placeOrdersFromCart(command.principal.userId, command.addressId, command.displayCurrency);
  }
}
