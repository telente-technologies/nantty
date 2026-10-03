import { validationError } from "../../../../errors/notifications.error.js";
import type { IdentityDirectory } from "../../../../interfaces/identityDirectory.interface.js";
import type { UnsubscribeTokenService } from "../../services/unsubscribeToken.service.js";
import type { UnsubscribeFromMarketingCommand } from "./unsubscribeFromMarketing.command.js";

export class UnsubscribeFromMarketingHandler {
  public constructor(private readonly tokens: UnsubscribeTokenService, private readonly identity: IdentityDirectory) {}

  public async execute(command: UnsubscribeFromMarketingCommand): Promise<{ readonly unsubscribed: true }> {
    const accountId = this.tokens.verify(command.token);
    if (accountId === null) throw validationError("This unsubscribe link is not valid.");
    await this.identity.withdrawMarketingConsent(accountId);
    return { unsubscribed: true };
  }
}
