import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class BlockUserCommand extends Command<"follows.blockUser"> {
  public constructor(
    public readonly principal: Principal,
    public readonly blockedUserId: string,
  ) {
    super("follows.blockUser");
  }
}
