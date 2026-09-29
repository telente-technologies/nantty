import { CommandHandler } from "@zudojs/cqrs";

import type { AdminLoginStarted } from "../../services/adminSignIn.service.js";
import type { AdminServices } from "../../services/adminServices.service.js";
import type { StartAdminLoginCommand } from "./startAdminLogin.command.js";

export class StartAdminLoginHandler extends CommandHandler<StartAdminLoginCommand, AdminLoginStarted> {
  public readonly commandType = "admin.startAdminLogin" as const;

  public constructor(private readonly service: AdminServices) {
    super();
  }

  public execute(command: StartAdminLoginCommand): Promise<AdminLoginStarted> {
    return this.service.signIn.startLogin(command.email, command.password, command.client);
  }
}
