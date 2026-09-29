import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class RemoveCartItemCommand extends Command<"carts.removeCartItem"> {
  public constructor(
    public readonly principal: Principal,
    public readonly variantId: string,
  ) {
    super("carts.removeCartItem");
  }
}
