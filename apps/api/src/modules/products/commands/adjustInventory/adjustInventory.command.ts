import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class AdjustInventoryCommand extends Command<"products.adjustInventory"> {
  public constructor(
    public readonly principal: Principal,
    public readonly storeId: string,
    public readonly productId: string,
    public readonly variantId: string,
    public readonly delta: number,
  ) {
    super("products.adjustInventory");
  }
}
