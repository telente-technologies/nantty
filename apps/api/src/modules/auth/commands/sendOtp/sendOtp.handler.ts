import { CommandHandler } from "@zudojs/cqrs";

import type { AuthService } from "../../services/auth.service.js";
import { convertRequestedPurposeToOtpPurpose, parseContactAddress } from "../../services/contact.service.js";
import type { SendOtpCommand } from "./sendOtp.command.js";

export class SendOtpHandler extends CommandHandler<SendOtpCommand, { readonly expiresIn: number }> {
  public readonly commandType = "auth.sendOtp" as const;

  public constructor(private readonly auth: AuthService) {
    super();
  }

  public async execute(command: SendOtpCommand): Promise<{ readonly expiresIn: number }> {
    const { otp } = this.auth.dependencies;
    const contact = parseContactAddress(command.input.destination);
    const purpose = convertRequestedPurposeToOtpPurpose(command.input.purpose);
    const existingUser = await this.auth.findUserByContact(contact);
    const shouldSend = purpose === "signup" ? existingUser === undefined : existingUser?.status === "active";
    if (shouldSend) await otp.sendOneTimeCode(contact, purpose);
    return { expiresIn: otp.codeLifetimeSeconds };
  }
}
