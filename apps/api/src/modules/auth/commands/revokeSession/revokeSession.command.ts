import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class RevokeSessionCommand extends Command<"auth.revokeSession"> {
  public constructor(
    public readonly principal: Principal,
    public readonly sessionId: string,
  ) {
    super("auth.revokeSession");
  }
}
