import { createHash } from "node:crypto";

import { validationError } from "../../../../errors/notifications.error.js";
import type { IdentityDirectory } from "../../../../interfaces/identityDirectory.interface.js";
import type { UnsubscribeReceiptRepository } from "../../../../interfaces/repositories.interface.js";
import type { UnsubscribeTokenService } from "../../services/unsubscribeToken.service.js";
import type { UnsubscribeFromMarketingCommand } from "./unsubscribeFromMarketing.command.js";

export class UnsubscribeFromMarketingHandler {
  public constructor(
    private readonly tokens: UnsubscribeTokenService,
    private readonly identity: IdentityDirectory,
    private readonly receipts: UnsubscribeReceiptRepository,
  ) {}

  public async execute(command: UnsubscribeFromMarketingCommand): Promise<{ readonly unsubscribed: true }> {
    const accountId = this.tokens.verify(command.token);
    if (accountId === null) throw validationError("This unsubscribe link is not valid.");
    const tokenHash = createHash("sha256").update(command.token).digest("hex");
    if (!(await this.receipts.claim(tokenHash, accountId))) return { unsubscribed: true };
    try {
      await this.identity.withdrawMarketingConsent(accountId);
    } catch (error) {
      await this.receipts.release(tokenHash);
      throw error;
    }
    return { unsubscribed: true };
  }
}
