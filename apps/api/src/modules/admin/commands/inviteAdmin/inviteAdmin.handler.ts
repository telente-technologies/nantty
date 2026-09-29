import { CommandHandler } from "@zudojs/cqrs";

import type { AdminServices } from "../../services/adminServices.service.js";
import type { StaffAdministrationService } from "../../services/staffAdministration.service.js";
import type { InviteAdminCommand } from "./inviteAdmin.command.js";

export class InviteAdminHandler extends CommandHandler<InviteAdminCommand, Awaited<ReturnType<StaffAdministrationService["inviteAdmin"]>>> {
  public readonly commandType = "admin.inviteAdmin" as const;

  public constructor(private readonly service: AdminServices) {
    super();
  }

  public execute(command: InviteAdminCommand): Promise<Awaited<ReturnType<StaffAdministrationService["inviteAdmin"]>>> {
    return this.service.administration.inviteAdmin(command.staff.account, command.input);
  }
}
