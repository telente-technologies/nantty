import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";
import type { ProductChoice } from "../../services/carts.service.js";

export class AddCartItemCommand extends Command<"carts.addCartItem"> {
  public constructor(
    public readonly principal: Principal,
    public readonly choice: ProductChoice,
  ) {
    super("carts.addCartItem");
  }
}
