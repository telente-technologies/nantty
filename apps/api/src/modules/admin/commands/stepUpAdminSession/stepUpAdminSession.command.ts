import { Command } from "@zudojs/cqrs";

import type { SecondFactorProof } from "../../services/adminSignIn.service.js";
import type { StaffRequestState } from "../../services/staffRequestGuard.service.js";

export class StepUpAdminSessionCommand extends Command<"admin.stepUpAdminSession"> {
  public constructor(
    public readonly staff: StaffRequestState,
    public readonly proof: SecondFactorProof,
  ) {
    super("admin.stepUpAdminSession");
  }
}
