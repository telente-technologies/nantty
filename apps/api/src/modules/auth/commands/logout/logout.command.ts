import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class LogoutCommand extends Command<"auth.logout"> {
  public constructor(
    public readonly principal: Principal | undefined,
    public readonly refreshToken: string | undefined,
  ) {
    super("auth.logout");
  }
}
