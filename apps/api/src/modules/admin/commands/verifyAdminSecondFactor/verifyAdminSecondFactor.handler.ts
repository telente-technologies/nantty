import { CommandHandler } from "@zudojs/cqrs";

import type { AdminServices } from "../../services/adminServices.service.js";
import type { AdminSignedIn } from "../../services/adminSignIn.service.js";
import type { VerifyAdminSecondFactorCommand } from "./verifyAdminSecondFactor.command.js";

export class VerifyAdminSecondFactorHandler extends CommandHandler<VerifyAdminSecondFactorCommand, AdminSignedIn> {
  public readonly commandType = "admin.verifyAdminSecondFactor" as const;

  public constructor(private readonly service: AdminServices) {
    super();
  }

  public execute(command: VerifyAdminSecondFactorCommand): Promise<AdminSignedIn> {
    return this.service.signIn.verifySecondFactor(command.mfaToken, command.proof, command.client);
  }
}
