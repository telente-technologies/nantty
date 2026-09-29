import { CommandHandler } from "@zudojs/cqrs";

import type { CartsService } from "../../services/carts.service.js";
import type { RemoveCartItemCommand } from "./removeCartItem.command.js";

export class RemoveCartItemHandler extends CommandHandler<RemoveCartItemCommand, void> {
  public readonly commandType = "carts.removeCartItem" as const;

  public constructor(private readonly service: CartsService) {
    super();
  }

  public execute(command: RemoveCartItemCommand): Promise<void> {
    return this.service.removeItemFromCart(command.principal.userId, command.variantId);
  }
}
