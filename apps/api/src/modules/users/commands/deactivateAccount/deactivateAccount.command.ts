import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class DeactivateAccountCommand extends Command<"users.deactivateAccount"> {
  public constructor(
    public readonly principal: Principal,
  ) {
    super("users.deactivateAccount");
  }
}
