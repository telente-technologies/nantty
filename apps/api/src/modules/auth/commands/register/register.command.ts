import { Command } from "@zudojs/cqrs";

import type { ClientDetails } from "../../models/auth.model.js";
import type { RegisterBody } from "../../validators/auth.validator.js";

export class RegisterCommand extends Command<"auth.register"> {
  public constructor(
    public readonly input: RegisterBody,
    public readonly client: ClientDetails,
  ) {
    super("auth.register");
  }
}
