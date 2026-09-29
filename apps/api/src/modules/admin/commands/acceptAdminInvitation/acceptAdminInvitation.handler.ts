import { CommandHandler } from "@zudojs/cqrs";

import type { AdminLoginStarted } from "../../services/adminSignIn.service.js";
import type { AdminServices } from "../../services/adminServices.service.js";
import type { AcceptAdminInvitationCommand } from "./acceptAdminInvitation.command.js";

export class AcceptAdminInvitationHandler extends CommandHandler<AcceptAdminInvitationCommand, AdminLoginStarted> {
  public readonly commandType = "admin.acceptAdminInvitation" as const;

  public constructor(private readonly service: AdminServices) {
    super();
  }

  public execute(command: AcceptAdminInvitationCommand): Promise<AdminLoginStarted> {
    return this.service.administration.acceptInvitation(command.token, command.password);
  }
}
