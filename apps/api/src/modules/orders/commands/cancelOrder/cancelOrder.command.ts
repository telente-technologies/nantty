import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class CancelOrderCommand extends Command<"orders.cancelOrder"> {
  public constructor(
    public readonly principal: Principal,
    public readonly orderId: string,
  ) {
    super("orders.cancelOrder");
  }
}
