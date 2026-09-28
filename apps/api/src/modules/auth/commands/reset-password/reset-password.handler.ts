import { CommandHandler } from "@zudojs/cqrs";
import { BadRequestError } from "@zudojs/errors";

import { publishEvent } from "../../../../loaders/events.loader.js";
import { PasswordResetCompletedEvent } from "../../events/password-reset-completed.event.js";
import type { AuthService } from "../../services/auth.service.js";
import { parseContactAddress } from "../../services/contact.service.js";
import type { ResetPasswordCommand } from "./reset-password.command.js";

export class ResetPasswordHandler extends CommandHandler<ResetPasswordCommand, void> {
  public readonly commandType = "auth.reset-password" as const;

  public constructor(private readonly auth: AuthService) {
    super();
  }

  public async execute(command: ResetPasswordCommand): Promise<void> {
    const { passwords, otp, users, sessions, clock, events, audit } = this.auth.dependencies;
    const contact = parseContactAddress(command.input.target);
    passwords.assertPasswordMeetsPolicy(command.input.newPassword);
    const codeIsValid = await otp.verifyAndConsumeOneTimeCode(contact, "reset_password", command.input.code);
    const user = codeIsValid ? await this.auth.findUserByContact(contact) : undefined;
    if (user === undefined) throw new BadRequestError("The code is invalid or has expired.");
    await users.updatePasswordHash(user.id, await passwords.hashNewPassword(command.input.newPassword));
    await sessions.revokeAllForUser(user.id, "password_reset", clock.now());
    await audit.record({ actorId: user.id, action: "auth.password_reset", entityType: "user", entityId: user.id });
    await publishEvent(events, PasswordResetCompletedEvent, { userId: user.id });
  }
}
