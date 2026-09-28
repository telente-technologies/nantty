import { Command } from "@zudojs/cqrs";

import type { ClientDetails, SocialProvider } from "../../models/auth.model.js";
import type { SocialSignInBody } from "../../validators/auth.validator.js";

export class SocialSignInCommand extends Command<"auth.socialSignIn"> {
  public constructor(
    public readonly provider: SocialProvider,
    public readonly input: SocialSignInBody,
    public readonly client: ClientDetails,
  ) {
    super("auth.socialSignIn");
  }
}
