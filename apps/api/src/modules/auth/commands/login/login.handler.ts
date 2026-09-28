import { CommandHandler } from "@zudojs/cqrs";
import { ForbiddenError, UnauthorizedError } from "@zudojs/errors";

import { publishEvent } from "../../../../loaders/events.loader.js";
import { UserLoggedInEvent } from "../../events/user-logged-in.event.js";
import type { AuthenticationResult } from "../../models/auth.model.js";
import type { AuthService } from "../../services/auth.service.js";
import type { LoginCommand } from "./login.command.js";

export class LoginHandler extends CommandHandler<LoginCommand, AuthenticationResult> {
  public readonly commandType = "auth.login" as const;

  public constructor(private readonly auth: AuthService) {
    super();
  }

  public async execute(command: LoginCommand): Promise<AuthenticationResult> {
    const { passwords, tokens, events } = this.auth.dependencies;
    const user = await this.auth.findUserByEmailPhoneOrUsername(command.identifier);
    const passwordMatches = await passwords.verifyPasswordAgainstStoredHash(command.password, user?.passwordHash ?? null);
    if (user === undefined || !passwordMatches) throw new UnauthorizedError("Incorrect login details.");
    if (user.status !== "active") throw new ForbiddenError("This account has been deactivated.");
    const issued = await tokens.startSessionForUser(user, command.client);
    await publishEvent(events, UserLoggedInEvent, { userId: user.id, sessionId: issued.sessionId, method: "password" });
    return { user, tokens: issued, isNewUser: false };
  }
}
