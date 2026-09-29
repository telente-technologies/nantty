import { CommandHandler } from "@zudojs/cqrs";

import type { CartsService } from "../../services/carts.service.js";
import type { AddCartItemCommand } from "./addCartItem.command.js";

export class AddCartItemHandler extends CommandHandler<AddCartItemCommand, void> {
  public readonly commandType = "carts.addCartItem" as const;

  public constructor(private readonly service: CartsService) {
    super();
  }

  public execute(command: AddCartItemCommand): Promise<void> {
    return this.service.addProductToCart(command.principal.userId, command.choice);
  }
}
