import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";
import type { SecondFactorProof } from "../../services/staffMfa.service.js";

export class StepUpAdminSessionCommand extends Command<"admin.stepUpAdminSession"> {
  public constructor(
    public readonly principal: Principal,
    public readonly proof: SecondFactorProof,
  ) {
    super("admin.stepUpAdminSession");
  }
}
