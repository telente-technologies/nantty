import { CommandHandler } from "@zudojs/cqrs";

import type { WalletTopUpRecord } from "../../models/wallets.model.js";
import type { WalletTopUpsService } from "../../services/walletTopUps.service.js";
import type { VerifyWalletTopUpCommand } from "./verifyWalletTopUp.command.js";

export class VerifyWalletTopUpHandler extends CommandHandler<VerifyWalletTopUpCommand, WalletTopUpRecord> {
  public readonly commandType = "wallets.verifyWalletTopUp" as const;

  public constructor(private readonly service: WalletTopUpsService) {
    super();
  }

  public execute(command: VerifyWalletTopUpCommand): Promise<WalletTopUpRecord> {
    return this.service.verifyTopUpForUser(command.principal.userId, command.reference);
  }
}
