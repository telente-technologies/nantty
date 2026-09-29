import { CommandHandler } from "@zudojs/cqrs";

import type { AdminLoginChallenge } from "../../services/adminSession.service.js";
import type { AdminModuleServices } from "../../services/adminModule.service.js";
import type { StartAdminLoginCommand } from "./startAdminLogin.command.js";

export class StartAdminLoginHandler extends CommandHandler<StartAdminLoginCommand, AdminLoginChallenge> {
  public readonly commandType = "admin.startAdminLogin" as const;

  public constructor(private readonly service: AdminModuleServices) {
    super();
  }

  public async execute(command: StartAdminLoginCommand): Promise<AdminLoginChallenge> {
    return this.service.sessions.startLogin(command.identifier, command.password);
  }
}
