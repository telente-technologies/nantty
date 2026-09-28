import { CommandHandler } from "@zudojs/cqrs";

import { unprocessable } from "../../../../errors/domain.error.js";
import { publishEvent } from "../../../../loaders/events.loader.js";
import { UserRegisteredEvent } from "../../events/user-registered.event.js";
import type { AuthenticationResult } from "../../models/auth.model.js";
import type { AuthService } from "../../services/auth.service.js";
import { normalizeUsername, parseContactAddress, type ContactAddress } from "../../services/contact.service.js";
import type { RegisterCommand } from "./register.command.js";

export class RegisterHandler extends CommandHandler<RegisterCommand, AuthenticationResult> {
  public readonly commandType = "auth.register" as const;

  public constructor(private readonly auth: AuthService) {
    super();
  }

  public async execute(command: RegisterCommand): Promise<AuthenticationResult> {
    const { passwords, tokens, otp, events } = this.auth.dependencies;
    const emailContact = command.input.email === undefined ? undefined : parseContactAddress(command.input.email);
    const phoneContact = command.input.phone === undefined ? undefined : parseContactAddress(command.input.phone);
    if (emailContact === undefined && phoneContact === undefined) {
      throw unprocessable("Provide an email address or a phone number.");
    }
    if (emailContact?.kind === "phone" || phoneContact?.kind === "email") throw unprocessable("Check the email address and phone number.");
    passwords.assertPasswordMeetsPolicy(command.input.password);
    const birthday = new Date(`${command.input.birthday}T00:00:00.000Z`);
    this.auth.assertBirthdayMeetsMinimumAge(birthday);

    const user = await this.auth.createBuyerAccount({
      email: emailContact?.value ?? null,
      phone: phoneContact?.value ?? null,
      username: normalizeUsername(command.input.username),
      passwordHash: await passwords.hashNewPassword(command.input.password),
      name: command.input.name?.trim() ?? "",
      birthday,
    });
    const issued = await tokens.startSessionForUser(user, command.client);
    await this.sendVerificationCodeWithoutFailingRegistration(emailContact ?? phoneContact);
    await publishEvent(events, UserRegisteredEvent, { userId: user.id, username: user.username, method: "password" });
    return { user, tokens: issued, isNewUser: true };
  }

  private async sendVerificationCodeWithoutFailingRegistration(contact: ContactAddress | undefined): Promise<void> {
    if (contact === undefined) return;
    try {
      await this.auth.dependencies.otp.sendOneTimeCode(contact, "verify_contact");
    } catch {
      return;
    }
  }
}
