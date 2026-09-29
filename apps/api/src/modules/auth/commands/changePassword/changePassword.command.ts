import { Command } from "@zudojs/cqrs";

import type { ChangePasswordBody } from "../../validators/auth.validator.js";
import type { Principal } from "../../../../interfaces/principal.interface.js";

export class ChangePasswordCommand extends Command<"auth.changePassword"> {
  public constructor(
    public readonly principal: Principal,
    public readonly input: ChangePasswordBody,
  ) {
    super("auth.changePassword");
  }
}
