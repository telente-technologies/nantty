import { CommandHandler } from "@zudojs/cqrs";

import type { AdminModuleServices } from "../../services/adminModule.service.js";
import type { CompletedAdminLogin } from "../../services/adminSession.service.js";
import type { CompleteAdminLoginCommand } from "./completeAdminLogin.command.js";

export class CompleteAdminLoginHandler extends CommandHandler<CompleteAdminLoginCommand, CompletedAdminLogin> {
  public readonly commandType = "admin.completeAdminLogin" as const;

  public constructor(private readonly service: AdminModuleServices) {
    super();
  }

  public async execute(command: CompleteAdminLoginCommand): Promise<CompletedAdminLogin> {
    return this.service.sessions.completeLogin(command.challengeToken, command.proof, command.client);
  }
}
