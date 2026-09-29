import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class RevokeAdInviteCommand extends Command<"ads.revokeAdInvite"> {
  public constructor(
    public readonly principal: Principal,
    public readonly accountId: string,
    public readonly inviteId: string,
  ) {
    super("ads.revokeAdInvite");
  }
}
