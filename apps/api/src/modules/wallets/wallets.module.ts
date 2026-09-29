import { BaseModule, type ModuleContext } from "@zudojs/core";
import type { CommandBus, QueryBus } from "@zudojs/cqrs";

import { registerCommandHandlers, registerQueryHandlers } from "../../utils/cqrs.util.js";
import { AddPayoutAccountHandler } from "./commands/addPayoutAccount/addPayoutAccount.handler.js";
import { ProcessWithdrawalHandler } from "./commands/processWithdrawal/processWithdrawal.handler.js";
import { RemovePayoutAccountHandler } from "./commands/removePayoutAccount/removePayoutAccount.handler.js";
import { RequestWithdrawalHandler } from "./commands/requestWithdrawal/requestWithdrawal.handler.js";
import { GetWalletHandler } from "./queries/getWallet/getWallet.handler.js";
import { ListPayoutAccountsHandler } from "./queries/listPayoutAccounts/listPayoutAccounts.handler.js";
import { ListWalletTransactionsHandler } from "./queries/listWalletTransactions/listWalletTransactions.handler.js";
import { ListWithdrawalsHandler } from "./queries/listWithdrawals/listWithdrawals.handler.js";
import type { WalletsService } from "./services/wallets.service.js";

export class WalletsModule extends BaseModule {
  public readonly id = "wallets";
  public readonly name = "wallets";

  public constructor() {
    super({ version: "0.1.0" });
  }

  public override async onInitialize(context: ModuleContext): Promise<void> {
    context.logger.info("wallets module initialized");
  }

  public override async onShutdown(context: ModuleContext): Promise<void> {
    context.logger.info("wallets module stopped");
  }
}

export function registerWalletsCommandAndQueryHandlers(commands: CommandBus, queries: QueryBus, walletsService: WalletsService): void {
  registerCommandHandlers(commands, [
    new AddPayoutAccountHandler(walletsService),
    new RemovePayoutAccountHandler(walletsService),
    new RequestWithdrawalHandler(walletsService),
    new ProcessWithdrawalHandler(walletsService),
  ]);
  registerQueryHandlers(queries, [
    new GetWalletHandler(walletsService),
    new ListPayoutAccountsHandler(walletsService),
    new ListWalletTransactionsHandler(walletsService),
    new ListWithdrawalsHandler(walletsService),
  ]);
}
