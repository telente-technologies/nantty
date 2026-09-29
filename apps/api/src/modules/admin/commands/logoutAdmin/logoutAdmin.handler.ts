import { CommandHandler } from "@zudojs/cqrs";

import type { AdminServices } from "../../services/adminServices.service.js";
import type { LogoutAdminCommand } from "./logoutAdmin.command.js";

export class LogoutAdminHandler extends CommandHandler<LogoutAdminCommand, void> {
  public readonly commandType = "admin.logoutAdmin" as const;

  public constructor(private readonly service: AdminServices) {
    super();
  }

  public async execute(command: LogoutAdminCommand): Promise<void> {
    await this.service.signIn.logout(command.refreshToken);
  }
}
