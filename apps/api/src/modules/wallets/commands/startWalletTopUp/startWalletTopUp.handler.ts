import { CommandHandler } from "@zudojs/cqrs";

import type { StartedWalletTopUp } from "../../services/walletTopUps.service.js";
import type { WalletTopUpsService } from "../../services/walletTopUps.service.js";
import type { StartWalletTopUpCommand } from "./startWalletTopUp.command.js";

export class StartWalletTopUpHandler extends CommandHandler<StartWalletTopUpCommand, StartedWalletTopUp> {
  public readonly commandType = "wallets.startWalletTopUp" as const;

  public constructor(private readonly service: WalletTopUpsService) {
    super();
  }

  public execute(command: StartWalletTopUpCommand): Promise<StartedWalletTopUp> {
    return this.service.startTopUp(command.principal.userId, command.amount, command.currency, command.provider, command.returnTo);
  }
}
