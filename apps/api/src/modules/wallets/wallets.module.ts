import { BaseModule, type ModuleContext } from "@zudojs/core";
import type { CommandBus, QueryBus } from "@zudojs/cqrs";

import { registerCommandHandlers, registerQueryHandlers } from "../../utils/cqrs.util.js";
import { AddPayoutAccountHandler } from "./commands/addPayoutAccount/addPayoutAccount.handler.js";
import { ProcessWithdrawalHandler } from "./commands/processWithdrawal/processWithdrawal.handler.js";
import { RemovePayoutAccountHandler } from "./commands/removePayoutAccount/removePayoutAccount.handler.js";
import { RequestWithdrawalHandler } from "./commands/requestWithdrawal/requestWithdrawal.handler.js";
import { StartWalletTopUpHandler } from "./commands/startWalletTopUp/startWalletTopUp.handler.js";
import { VerifyWalletTopUpHandler } from "./commands/verifyWalletTopUp/verifyWalletTopUp.handler.js";
import { GetWalletHandler } from "./queries/getWallet/getWallet.handler.js";
import { ListPayoutAccountsHandler } from "./queries/listPayoutAccounts/listPayoutAccounts.handler.js";
import { ListWalletTransactionsHandler } from "./queries/listWalletTransactions/listWalletTransactions.handler.js";
import { QuoteWithdrawalHandler } from "./queries/quoteWithdrawal/quoteWithdrawal.handler.js";
import { ListWithdrawalsHandler } from "./queries/listWithdrawals/listWithdrawals.handler.js";
import type { WalletTopUpsService } from "./services/walletTopUps.service.js";
import type { WalletsService } from "./services/wallets.service.js";
import type { WithdrawalsService } from "./services/withdrawals.service.js";

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

export function registerWalletsCommandAndQueryHandlers(
  commands: CommandBus,
  queries: QueryBus,
  services: { readonly wallets: WalletsService; readonly withdrawals: WithdrawalsService; readonly topUps: WalletTopUpsService },
): void {
  registerCommandHandlers(commands, [
    new AddPayoutAccountHandler(services.wallets),
    new RemovePayoutAccountHandler(services.wallets),
    new RequestWithdrawalHandler(services.withdrawals),
    new ProcessWithdrawalHandler(services.withdrawals),
    new StartWalletTopUpHandler(services.topUps),
    new VerifyWalletTopUpHandler(services.topUps),
  ]);
  registerQueryHandlers(queries, [
    new GetWalletHandler(services.wallets),
    new ListPayoutAccountsHandler(services.wallets),
    new ListWalletTransactionsHandler(services.wallets),
    new ListWithdrawalsHandler(services.withdrawals),
    new QuoteWithdrawalHandler(services.withdrawals),
  ]);
}
