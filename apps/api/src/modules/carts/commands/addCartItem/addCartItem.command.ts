import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class AddCartItemCommand extends Command<"carts.addCartItem"> {
  public constructor(
    public readonly principal: Principal,
    public readonly variantId: string,
    public readonly quantity: number,
  ) {
    super("carts.addCartItem");
  }
}
