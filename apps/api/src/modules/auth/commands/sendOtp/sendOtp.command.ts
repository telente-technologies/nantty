import { Command } from "@zudojs/cqrs";

import type { SendOneTimeCodeBody } from "../../validators/auth.validator.js";

export class SendOtpCommand extends Command<"auth.sendOtp"> {
  public constructor(
    public readonly input: SendOneTimeCodeBody,
  ) {
    super("auth.sendOtp");
  }
}
