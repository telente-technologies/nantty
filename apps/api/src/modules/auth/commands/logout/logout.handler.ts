import { CommandHandler } from "@zudojs/cqrs";

import type { AuthService } from "../../services/auth.service.js";
import type { LogoutCommand } from "./logout.command.js";

export class LogoutHandler extends CommandHandler<LogoutCommand, void> {
  public readonly commandType = "auth.logout" as const;

  public constructor(private readonly auth: AuthService) {
    super();
  }

  public async execute(command: LogoutCommand): Promise<void> {
    const { sessions, clock } = this.auth.dependencies;
    await sessions.revoke(command.principal.sessionId, "logout", clock.now());
  }
}
