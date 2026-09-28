import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";
import type { ClientDetails } from "../../models/auth.model.js";
import type { VerifyOneTimeCodeBody } from "../../validators/auth.validator.js";

export class VerifyOtpCommand extends Command<"auth.verifyOtp"> {
  public constructor(
    public readonly input: VerifyOneTimeCodeBody,
    public readonly principal: Principal | undefined,
    public readonly client: ClientDetails,
  ) {
    super("auth.verifyOtp");
  }
}
