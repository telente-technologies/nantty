import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class OpenDisputeCommand extends Command<"escrows.openDispute"> {
  public constructor(
    public readonly principal: Principal,
    public readonly orderId: string,
    public readonly reason: string,
    public readonly details: string,
  ) {
    super("escrows.openDispute");
  }
}
