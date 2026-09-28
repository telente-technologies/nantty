import { CommandHandler } from "@zudojs/cqrs";
import { UnauthorizedError } from "@zudojs/errors";

import { unprocessable } from "../../../../errors/domain.error.js";
import type { AuthService } from "../../services/auth.service.js";
import { parseContactAddress } from "../../services/contact.service.js";
import type { SendOtpCommand } from "./send-otp.command.js";

export class SendOtpHandler extends CommandHandler<SendOtpCommand, void> {
  public readonly commandType = "auth.send-otp" as const;

  public constructor(private readonly auth: AuthService) {
    super();
  }

  public async execute(command: SendOtpCommand): Promise<void> {
    const { users, otp } = this.auth.dependencies;
    const contact = parseContactAddress(command.input.target);
    if (command.input.purpose === "verify_contact") {
      if (command.principal === undefined) throw new UnauthorizedError("Sign in to verify your contact details.");
      const user = await users.findById(command.principal.userId);
      const ownsContact = contact.kind === "email" ? user?.email === contact.value : user?.phone === contact.value;
      if (!ownsContact) throw unprocessable("This is not the email address or phone number on your account.");
      await otp.sendOneTimeCode(contact, "verify_contact");
      return;
    }
    const user = await this.auth.findUserByContact(contact);
    if (user !== undefined && user.status === "active") await otp.sendOneTimeCode(contact, "login");
  }
}
