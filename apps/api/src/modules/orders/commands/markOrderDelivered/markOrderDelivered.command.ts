import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class MarkOrderDeliveredCommand extends Command<"orders.markOrderDelivered"> {
  public constructor(
    public readonly principal: Principal,
    public readonly storeId: string,
    public readonly orderId: string,
  ) {
    super("orders.markOrderDelivered");
  }
}
