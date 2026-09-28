import { CommandHandler } from "@zudojs/cqrs";
import { BadRequestError, UnauthorizedError } from "@zudojs/errors";

import { publishEvent } from "../../../../loaders/events.loader.js";
import { UserLoggedInEvent } from "../../events/user-logged-in.event.js";
import type { AuthenticationResult } from "../../models/auth.model.js";
import type { AuthService } from "../../services/auth.service.js";
import { parseContactAddress } from "../../services/contact.service.js";
import type { VerifyOtpCommand } from "./verify-otp.command.js";

export type VerifyOtpResult = { readonly verified: true } | AuthenticationResult;

export class VerifyOtpHandler extends CommandHandler<VerifyOtpCommand, VerifyOtpResult> {
  public readonly commandType = "auth.verify-otp" as const;

  public constructor(private readonly auth: AuthService) {
    super();
  }

  public async execute(command: VerifyOtpCommand): Promise<VerifyOtpResult> {
    const { otp, users, tokens, events, clock } = this.auth.dependencies;
    const contact = parseContactAddress(command.input.target);
    if (command.input.purpose === "verify_contact" && command.principal === undefined) {
      throw new UnauthorizedError("Sign in to verify your contact details.");
    }
    const codeIsValid = await otp.verifyAndConsumeOneTimeCode(contact, command.input.purpose, command.input.code);
    const user = codeIsValid ? await this.auth.findUserByContact(contact) : undefined;
    if (user === undefined || user.status !== "active") throw new BadRequestError("The code is invalid or has expired.");
    if (command.input.purpose === "verify_contact") {
      if (user.id !== command.principal?.userId) throw new BadRequestError("The code is invalid or has expired.");
      await users.markContactVerified(user.id, contact.kind, clock.now());
      return { verified: true };
    }
    await users.markContactVerified(user.id, contact.kind, clock.now());
    const issued = await tokens.startSessionForUser(user, command.client);
    await publishEvent(events, UserLoggedInEvent, { userId: user.id, sessionId: issued.sessionId, method: "one_time_code" });
    return { user, tokens: issued, isNewUser: false };
  }
}
