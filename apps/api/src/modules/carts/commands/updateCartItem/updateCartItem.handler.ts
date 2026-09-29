import { CommandHandler } from "@zudojs/cqrs";

import type { CartsService } from "../../services/carts.service.js";
import type { UpdateCartItemCommand } from "./updateCartItem.command.js";

export class UpdateCartItemHandler extends CommandHandler<UpdateCartItemCommand, void> {
  public readonly commandType = "carts.updateCartItem" as const;

  public constructor(private readonly service: CartsService) {
    super();
  }

  public execute(command: UpdateCartItemCommand): Promise<void> {
    return this.service.changeCartItemQuantity(command.principal.userId, command.cartItemId, command.quantity);
  }
}
