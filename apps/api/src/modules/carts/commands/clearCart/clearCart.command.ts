import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class ClearCartCommand extends Command<"carts.clearCart"> {
  public constructor(
    public readonly principal: Principal,
  ) {
    super("carts.clearCart");
  }
}
