import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class MarkOrderShippedCommand extends Command<"orders.markOrderShipped"> {
  public constructor(
    public readonly principal: Principal,
    public readonly orderId: string,
    public readonly trackingNumber: string | null,
    public readonly courier: string | null = null,
  ) {
    super("orders.markOrderShipped");
  }
}
