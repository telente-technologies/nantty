import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class UnblockUserCommand extends Command<"follows.unblockUser"> {
  public constructor(
    public readonly principal: Principal,
    public readonly blockedUserId: string,
  ) {
    super("follows.unblockUser");
  }
}
