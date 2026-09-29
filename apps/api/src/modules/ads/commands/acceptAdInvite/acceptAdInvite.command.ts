import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class AcceptAdInviteCommand extends Command<"ads.acceptAdInvite"> {
  public constructor(
    public readonly principal: Principal,
    public readonly token: string,
  ) {
    super("ads.acceptAdInvite");
  }
}
