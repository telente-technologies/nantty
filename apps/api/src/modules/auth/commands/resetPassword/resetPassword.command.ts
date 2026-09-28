import { Command } from "@zudojs/cqrs";

import type { ResetPasswordBody } from "../../validators/auth.validator.js";

export class ResetPasswordCommand extends Command<"auth.resetPassword"> {
  public constructor(
    public readonly input: ResetPasswordBody,
  ) {
    super("auth.resetPassword");
  }
}
