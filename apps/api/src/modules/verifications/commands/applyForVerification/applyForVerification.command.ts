import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";
import type { VerificationApplication } from "../../services/verifications.service.js";

export class ApplyForVerificationCommand extends Command<"verifications.applyForVerification"> {
  public constructor(
    public readonly principal: Principal,
    public readonly application: VerificationApplication,
  ) {
    super("verifications.applyForVerification");
  }
}
