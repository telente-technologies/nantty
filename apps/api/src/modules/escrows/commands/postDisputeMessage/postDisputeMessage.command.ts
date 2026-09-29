import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class PostDisputeMessageCommand extends Command<"escrows.postDisputeMessage"> {
  public constructor(
    public readonly principal: Principal,
    public readonly disputeId: string,
    public readonly text: string,
    public readonly attachmentMediaIds: readonly string[],
  ) {
    super("escrows.postDisputeMessage");
  }
}
