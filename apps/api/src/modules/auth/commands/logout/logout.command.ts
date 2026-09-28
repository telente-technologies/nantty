import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class LogoutCommand extends Command<"auth.logout"> {
  public constructor(
    public readonly principal: Principal,
  ) {
    super("auth.logout");
  }
}
