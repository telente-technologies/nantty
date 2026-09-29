import { CommandHandler } from "@zudojs/cqrs";

import type { CheckoutDiscountSource } from "../../../payments/services/checkoutDiscounts.service.js";
import type { CheckoutResult, OrdersService } from "../../services/orders.service.js";
import type { CheckoutCommand } from "./checkout.command.js";

export class CheckoutHandler extends CommandHandler<CheckoutCommand, CheckoutResult> {
  public readonly commandType = "orders.checkout" as const;

  public constructor(private readonly service: OrdersService, private readonly discounts: CheckoutDiscountSource | undefined) {
    super();
  }

  public async execute(command: CheckoutCommand): Promise<CheckoutResult> {
    const result = await this.service.placeOrdersFromCart(command.principal.userId, command.addressId, command.displayCurrency);
    if (!command.redeemLoyaltyPoints || this.discounts === undefined) return result;
    const loyaltyDiscount = await this.discounts.redeemAllPointsAtCheckout(command.principal.userId, result.checkout.id);
    return loyaltyDiscount === undefined ? result : { ...result, loyaltyDiscount };
  }
}
