import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";
import type { SendOneTimeCodeBody } from "../../validators/auth.validator.js";

export class SendOtpCommand extends Command<"auth.send-otp"> {
  public constructor(
    public readonly input: SendOneTimeCodeBody,
    public readonly principal: Principal | undefined,
  ) {
    super("auth.send-otp");
  }
}
