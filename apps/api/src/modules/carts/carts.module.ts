import { BaseModule, type ModuleContext } from "@zudojs/core";
import type { CommandBus, QueryBus } from "@zudojs/cqrs";

import { registerCommandHandlers, registerQueryHandlers } from "../../utils/cqrs.util.js";
import { AddCartItemHandler } from "./commands/addCartItem/addCartItem.handler.js";
import { ClearCartHandler } from "./commands/clearCart/clearCart.handler.js";
import { RemoveCartItemHandler } from "./commands/removeCartItem/removeCartItem.handler.js";
import { UpdateCartItemHandler } from "./commands/updateCartItem/updateCartItem.handler.js";
import { GetCartHandler } from "./queries/getCart/getCart.handler.js";
import type { CartsService } from "./services/carts.service.js";

export class CartsModule extends BaseModule {
  public readonly id = "carts";
  public readonly name = "carts";

  public constructor() {
    super({ version: "0.1.0" });
  }

  public override async onInitialize(context: ModuleContext): Promise<void> {
    context.logger.info("carts module initialized");
  }

  public override async onShutdown(context: ModuleContext): Promise<void> {
    context.logger.info("carts module stopped");
  }
}

export function registerCartsCommandAndQueryHandlers(commands: CommandBus, queries: QueryBus, cartsService: CartsService): void {
  registerCommandHandlers(commands, [
    new AddCartItemHandler(cartsService),
    new UpdateCartItemHandler(cartsService),
    new RemoveCartItemHandler(cartsService),
    new ClearCartHandler(cartsService),
  ]);
  registerQueryHandlers(queries, [new GetCartHandler(cartsService)]);
}
