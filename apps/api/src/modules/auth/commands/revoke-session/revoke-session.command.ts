import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class RevokeSessionCommand extends Command<"auth.revoke-session"> {
  public constructor(
    public readonly principal: Principal,
    public readonly sessionId: string,
  ) {
    super("auth.revoke-session");
  }
}
