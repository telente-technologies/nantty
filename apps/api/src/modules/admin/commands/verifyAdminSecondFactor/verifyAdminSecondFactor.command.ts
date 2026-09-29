import { Command } from "@zudojs/cqrs";

import type { SecondFactorProof } from "../../services/adminSignIn.service.js";
import type { StaffClient } from "../../services/adminTokens.service.js";

export class VerifyAdminSecondFactorCommand extends Command<"admin.verifyAdminSecondFactor"> {
  public constructor(
    public readonly mfaToken: string,
    public readonly proof: SecondFactorProof,
    public readonly client: StaffClient,
  ) {
    super("admin.verifyAdminSecondFactor");
  }
}
