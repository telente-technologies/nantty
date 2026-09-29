import { CommandHandler } from "@zudojs/cqrs";
import { UnauthorizedError } from "@zudojs/errors";

import type { AuthService } from "../../services/auth.service.js";
import type { ChangePasswordCommand } from "./changePassword.command.js";

export class ChangePasswordHandler extends CommandHandler<ChangePasswordCommand, void> {
  public readonly commandType = "auth.changePassword" as const;

  public constructor(private readonly auth: AuthService) {
    super();
  }

  public async execute(command: ChangePasswordCommand): Promise<void> {
    const { passwords, users, sessions, clock, audit } = this.auth.dependencies;
    const user = await users.findById(command.principal.userId);
    if (user === undefined || user.status !== "active") throw new UnauthorizedError("Sign in again.");
    if (user.passwordHash !== null) {
      const currentPasswordMatches = await passwords.verifyPasswordAgainstStoredHash(command.input.currentPassword ?? "", user.passwordHash);
      if (!currentPasswordMatches) throw new UnauthorizedError("Your current password is incorrect.");
    }
    passwords.assertPasswordMeetsPolicy(command.input.newPassword);
    await users.updatePasswordHash(user.id, await passwords.hashNewPassword(command.input.newPassword));
    const now = clock.now();
    for (const session of await sessions.listActiveForUser(user.id, now)) {
      if (session.id !== command.principal.sessionId) await sessions.revoke(session.id, "password_changed", now);
    }
    await audit.record({ actorId: user.id, action: "auth.password_changed", entityType: "user", entityId: user.id });
  }
}
