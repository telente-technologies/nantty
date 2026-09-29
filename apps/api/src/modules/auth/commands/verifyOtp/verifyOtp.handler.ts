import { CommandHandler } from "@zudojs/cqrs";
import { BadRequestError } from "@zudojs/errors";

import { publishEvent } from "../../../../loaders/events.loader.js";
import { UserLoggedInEvent } from "../../events/userLoggedIn.event.js";
import type { AuthenticationResult } from "../../models/auth.model.js";
import type { AuthService } from "../../services/auth.service.js";
import { convertRequestedPurposeToOtpPurpose, parseContactAddress } from "../../services/contact.service.js";
import type { VerifyOtpCommand } from "./verifyOtp.command.js";

export interface VerifyOtpResult {
  readonly otpToken: string;
  readonly session?: AuthenticationResult;
}

export class VerifyOtpHandler extends CommandHandler<VerifyOtpCommand, VerifyOtpResult> {
  public readonly commandType = "auth.verifyOtp" as const;

  public constructor(private readonly auth: AuthService) {
    super();
  }

  public async execute(command: VerifyOtpCommand): Promise<VerifyOtpResult> {
    const { otp, users, tokens, events, clock } = this.auth.dependencies;
    const contact = parseContactAddress(command.input.destination);
    const purpose = convertRequestedPurposeToOtpPurpose(command.input.purpose);
    const codeIsValid = await otp.verifyAndConsumeOneTimeCode(contact, purpose, command.input.code);
    if (!codeIsValid) throw new BadRequestError("The code is invalid or has expired.");
    if (purpose !== "login") return { otpToken: await otp.issueVerifiedDestinationToken(contact, purpose) };
    const user = await this.auth.findUserByContact(contact);
    if (user === undefined || user.status !== "active") throw new BadRequestError("The code is invalid or has expired.");
    await users.markContactVerified(user.id, contact.kind, clock.now());
    const issued = await tokens.startSessionForUser(user, command.client);
    await publishEvent(events, UserLoggedInEvent, { userId: user.id, sessionId: issued.sessionId, method: "one_time_code" });
    return { otpToken: await otp.issueVerifiedDestinationToken(contact, purpose), session: { user, tokens: issued, isNewUser: false } };
  }
}
