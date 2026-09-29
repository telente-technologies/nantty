import { BaseModule, type ModuleContext } from "@zudojs/core";
import type { CommandBus, QueryBus } from "@zudojs/cqrs";

import { registerCommandHandlers, registerQueryHandlers } from "../../utils/cqrs.util.js";
import { RedeemStoreReceiptHandler } from "./commands/redeemStoreReceipt/redeemStoreReceipt.handler.js";
import { SaveCoinPackHandler } from "./commands/saveCoinPack/saveCoinPack.handler.js";
import { StartCoinPurchaseHandler } from "./commands/startCoinPurchase/startCoinPurchase.handler.js";
import { TransferCoinsHandler } from "./commands/transferCoins/transferCoins.handler.js";
import { VerifyCoinPurchaseHandler } from "./commands/verifyCoinPurchase/verifyCoinPurchase.handler.js";
import { GetCoinBalanceHandler } from "./queries/getCoinBalance/getCoinBalance.handler.js";
import { ListCoinPacksHandler } from "./queries/listCoinPacks/listCoinPacks.handler.js";
import { ListCoinTransactionsHandler } from "./queries/listCoinTransactions/listCoinTransactions.handler.js";
import { QuoteCoinTransferHandler } from "./queries/quoteCoinTransfer/quoteCoinTransfer.handler.js";
import type { CoinsServices } from "./services/coinsServices.service.js";

export class CoinsModule extends BaseModule {
  public readonly id = "coins";
  public readonly name = "coins";

  public constructor() {
    super({ version: "0.1.0" });
  }

  public override async onInitialize(context: ModuleContext): Promise<void> {
    context.logger.info("coins module initialized");
  }

  public override async onShutdown(context: ModuleContext): Promise<void> {
    context.logger.info("coins module stopped");
  }
}

export function registerCoinsCommandAndQueryHandlers(commands: CommandBus, queries: QueryBus, services: CoinsServices): void {
  registerCommandHandlers(commands, [
    new StartCoinPurchaseHandler(services),
    new VerifyCoinPurchaseHandler(services),
    new RedeemStoreReceiptHandler(services),
    new TransferCoinsHandler(services),
    new SaveCoinPackHandler(services),
  ]);
  registerQueryHandlers(queries, [
    new GetCoinBalanceHandler(services),
    new ListCoinPacksHandler(services),
    new ListCoinTransactionsHandler(services),
    new QuoteCoinTransferHandler(services),
  ]);
}
