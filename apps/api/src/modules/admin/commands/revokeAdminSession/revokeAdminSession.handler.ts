import { CommandHandler } from "@zudojs/cqrs";

import type { AdminServices } from "../../services/adminServices.service.js";
import type { RevokeAdminSessionCommand } from "./revokeAdminSession.command.js";

export class RevokeAdminSessionHandler extends CommandHandler<RevokeAdminSessionCommand, void> {
  public readonly commandType = "admin.revokeAdminSession" as const;

  public constructor(private readonly service: AdminServices) {
    super();
  }

  public async execute(command: RevokeAdminSessionCommand): Promise<void> {
    await this.service.selfService.revokeSession(command.staff.account, command.sessionId);
  }
}
