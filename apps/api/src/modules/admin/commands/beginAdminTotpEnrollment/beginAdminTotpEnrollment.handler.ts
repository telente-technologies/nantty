import { CommandHandler } from "@zudojs/cqrs";

import type { AdminServices } from "../../services/adminServices.service.js";
import type { TotpEnrollment } from "../../services/staffMfa.service.js";
import type { BeginAdminTotpEnrollmentCommand } from "./beginAdminTotpEnrollment.command.js";

export class BeginAdminTotpEnrollmentHandler extends CommandHandler<BeginAdminTotpEnrollmentCommand, TotpEnrollment> {
  public readonly commandType = "admin.beginAdminTotpEnrollment" as const;

  public constructor(private readonly service: AdminServices) {
    super();
  }

  public execute(command: BeginAdminTotpEnrollmentCommand): Promise<TotpEnrollment> {
    return this.service.signIn.beginTotpEnrollment(command.mfaToken);
  }
}
