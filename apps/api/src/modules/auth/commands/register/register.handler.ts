import { randomBytes } from "node:crypto";

import { CommandHandler } from "@zudojs/cqrs";
import { BadRequestError } from "@zudojs/errors";

import { unprocessable } from "../../../../errors/domain.error.js";
import { publishEvent } from "../../../../loaders/events.loader.js";
import { UserRegisteredEvent } from "../../events/userRegistered.event.js";
import type { AuthenticationResult } from "../../models/auth.model.js";
import type { AuthService } from "../../services/auth.service.js";
import { normalizeUsername, parseContactAddress } from "../../services/contact.service.js";
import type { RegisterCommand } from "./register.command.js";

export class RegisterHandler extends CommandHandler<RegisterCommand, AuthenticationResult> {
  public readonly commandType = "auth.register" as const;

  public constructor(private readonly auth: AuthService) {
    super();
  }

  public async execute(command: RegisterCommand): Promise<AuthenticationResult> {
    const { passwords, tokens, otp, events, users, clock } = this.auth.dependencies;
    const emailContact = command.input.email === undefined ? undefined : parseContactAddress(command.input.email);
    const phoneContact = command.input.phone === undefined ? undefined : parseContactAddress(command.input.phone);
    if (emailContact === undefined && phoneContact === undefined) throw unprocessable("Provide an email address or a phone number.");
    if (emailContact?.kind === "phone" || phoneContact?.kind === "email") throw unprocessable("Check the email address and phone number.");
    passwords.assertPasswordMeetsPolicy(command.input.password);
    const birthday = new Date(`${command.input.birthday}T00:00:00.000Z`);
    this.auth.assertBirthdayMeetsMinimumAge(birthday);

    const verifiedContact = await otp.consumeVerifiedDestinationToken(
      "signup",
      command.input.otpToken,
      (contact) => contact.value === emailContact?.value || contact.value === phoneContact?.value,
    );
    if (verifiedContact === undefined) throw new BadRequestError("Verify your email address or phone number first.");

    const user = await this.auth.createBuyerAccount({
      email: emailContact?.value ?? null,
      phone: phoneContact?.value ?? null,
      username: await this.chooseUsername(command.input.username, emailContact?.value ?? command.input.name ?? "user"),
      passwordHash: await passwords.hashNewPassword(command.input.password),
      name: command.input.name?.trim() ?? "",
      birthday,
    });
    await users.markContactVerified(user.id, verifiedContact.kind, clock.now());
    const issued = await tokens.startSessionForUser(user, command.client);
    await publishEvent(events, UserRegisteredEvent, { userId: user.id, username: user.username, method: "password" });
    const refreshed = (await users.findById(user.id)) ?? user;
    return { user: refreshed, tokens: issued, isNewUser: true };
  }

  private async chooseUsername(requested: string | undefined, fallbackSource: string): Promise<string> {
    if (requested !== undefined) return normalizeUsername(requested);
    const base = normalizeUsername(fallbackSource.split("@")[0]?.replace(/[^A-Za-z0-9_.]/g, "") ?? "").slice(0, 20) || "user";
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = `${base}${randomBytes(3).toString("hex")}`;
      if ((await this.auth.dependencies.users.findByUsername(candidate)) === undefined) return candidate;
    }
    return `user${randomBytes(6).toString("hex")}`;
  }
}
