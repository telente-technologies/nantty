import { CommandHandler } from "@zudojs/cqrs";

import type { AdminModuleServices } from "../../services/adminModule.service.js";
import type { TotpEnrollment } from "../../services/staffMfa.service.js";
import type { BeginAdminTotpEnrollmentCommand } from "./beginAdminTotpEnrollment.command.js";

export class BeginAdminTotpEnrollmentHandler extends CommandHandler<BeginAdminTotpEnrollmentCommand, TotpEnrollment> {
  public readonly commandType = "admin.beginAdminTotpEnrollment" as const;

  public constructor(private readonly service: AdminModuleServices) {
    super();
  }

  public async execute(command: BeginAdminTotpEnrollmentCommand): Promise<TotpEnrollment> {
    return this.service.sessions.beginTotpEnrollment(command.challengeToken);
  }
}
