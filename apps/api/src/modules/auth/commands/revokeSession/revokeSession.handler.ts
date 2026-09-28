import { CommandHandler } from "@zudojs/cqrs";

import { notFound } from "../../../../errors/domain.error.js";
import type { AuthService } from "../../services/auth.service.js";
import type { RevokeSessionCommand } from "./revokeSession.command.js";

export class RevokeSessionHandler extends CommandHandler<RevokeSessionCommand, void> {
  public readonly commandType = "auth.revokeSession" as const;

  public constructor(private readonly auth: AuthService) {
    super();
  }

  public async execute(command: RevokeSessionCommand): Promise<void> {
    const { sessions, clock } = this.auth.dependencies;
    const session = await sessions.findById(command.sessionId);
    if (session === undefined || session.userId !== command.principal.userId) throw notFound("Session");
    await sessions.revoke(session.id, "revoked_by_user", clock.now());
  }
}
