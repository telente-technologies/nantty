import { CommandHandler } from "@zudojs/cqrs";

import type { CartsService } from "../../services/carts.service.js";
import type { ClearCartCommand } from "./clearCart.command.js";

export class ClearCartHandler extends CommandHandler<ClearCartCommand, void> {
  public readonly commandType = "carts.clearCart" as const;

  public constructor(private readonly service: CartsService) {
    super();
  }

  public execute(command: ClearCartCommand): Promise<void> {
    return this.service.clearCart(command.principal.userId);
  }
}
