import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class ChangeMessageReactionCommand extends Command<"messages.changeMessageReaction"> {
  public constructor(
    public readonly principal: Principal,
    public readonly messageId: string,
    public readonly emoji: string,
    public readonly react: boolean,
  ) {
    super("messages.changeMessageReaction");
  }
}
