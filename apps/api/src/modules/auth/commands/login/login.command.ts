import { Command } from "@zudojs/cqrs";

import type { ClientDetails } from "../../models/auth.model.js";

export class LoginCommand extends Command<"auth.login"> {
  public constructor(
    public readonly identifier: string,
    public readonly password: string,
    public readonly client: ClientDetails,
  ) {
    super("auth.login");
  }
}
