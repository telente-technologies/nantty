import { Command } from "@zudojs/cqrs";

import type { ClientDetails } from "../../models/auth.model.js";
import type { VerifyOneTimeCodeBody } from "../../validators/auth.validator.js";

export class VerifyOtpCommand extends Command<"auth.verifyOtp"> {
  public constructor(
    public readonly input: VerifyOneTimeCodeBody,
    public readonly client: ClientDetails,
  ) {
    super("auth.verifyOtp");
  }
}
