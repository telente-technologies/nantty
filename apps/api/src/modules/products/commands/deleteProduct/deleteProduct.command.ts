import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class DeleteProductCommand extends Command<"products.deleteProduct"> {
  public constructor(
    public readonly principal: Principal,
    public readonly storeId: string,
    public readonly productId: string,
  ) {
    super("products.deleteProduct");
  }
}
