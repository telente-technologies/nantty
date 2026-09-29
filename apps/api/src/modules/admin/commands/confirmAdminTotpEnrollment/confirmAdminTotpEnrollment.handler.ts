import { CommandHandler } from "@zudojs/cqrs";

import type { AdminServices } from "../../services/adminServices.service.js";
import type { AdminSignedIn } from "../../services/adminSignIn.service.js";
import type { ConfirmAdminTotpEnrollmentCommand } from "./confirmAdminTotpEnrollment.command.js";

export class ConfirmAdminTotpEnrollmentHandler extends CommandHandler<ConfirmAdminTotpEnrollmentCommand, AdminSignedIn> {
  public readonly commandType = "admin.confirmAdminTotpEnrollment" as const;

  public constructor(private readonly service: AdminServices) {
    super();
  }

  public execute(command: ConfirmAdminTotpEnrollmentCommand): Promise<AdminSignedIn> {
    return this.service.signIn.confirmTotpEnrollment(command.mfaToken, command.code, command.client);
  }
}
