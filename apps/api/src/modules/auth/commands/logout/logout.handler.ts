import { CommandHandler } from "@zudojs/cqrs";

import type { AuthService } from "../../services/auth.service.js";
import type { LogoutCommand } from "./logout.command.js";

export class LogoutHandler extends CommandHandler<LogoutCommand, void> {
  public readonly commandType = "auth.logout" as const;

  public constructor(private readonly auth: AuthService) {
    super();
  }

  public async execute(command: LogoutCommand): Promise<void> {
    const { sessions, tokens, clock } = this.auth.dependencies;
    const sessionFromRefreshToken = command.refreshToken === undefined ? undefined : tokens.findSessionIdInRefreshToken(command.refreshToken);
    for (const sessionId of new Set([command.principal?.sessionId, sessionFromRefreshToken])) {
      if (sessionId !== undefined) await sessions.revoke(sessionId, "logout", clock.now());
    }
  }
}
