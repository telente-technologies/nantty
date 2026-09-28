import { CommandHandler } from "@zudojs/cqrs";

import type { AuthService } from "../../services/auth.service.js";
import { parseContactAddress } from "../../services/contact.service.js";
import type { RequestPasswordResetCommand } from "./request-password-reset.command.js";

export class RequestPasswordResetHandler extends CommandHandler<RequestPasswordResetCommand, void> {
  public readonly commandType = "auth.request-password-reset" as const;

  public constructor(private readonly auth: AuthService) {
    super();
  }

  public async execute(command: RequestPasswordResetCommand): Promise<void> {
    const contact = parseContactAddress(command.target);
    const user = await this.auth.findUserByContact(contact);
    if (user === undefined || user.status !== "active") return;
    await this.auth.dependencies.otp.sendOneTimeCode(contact, "reset_password");
  }
}
