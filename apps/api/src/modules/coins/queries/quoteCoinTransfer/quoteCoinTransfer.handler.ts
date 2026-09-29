import { QueryHandler } from "@zudojs/cqrs";

import type { CoinTransferQuote } from "../../services/coinWallet.service.js";
import type { CoinsServices } from "../../services/coinsServices.service.js";
import type { QuoteCoinTransferQuery } from "./quoteCoinTransfer.query.js";

export class QuoteCoinTransferHandler extends QueryHandler<QuoteCoinTransferQuery, CoinTransferQuote> {
  public readonly queryType = "coins.quoteCoinTransfer" as const;

  public constructor(private readonly service: CoinsServices) {
    super();
  }

  public execute(query: QuoteCoinTransferQuery): Promise<CoinTransferQuote> {
    return Promise.resolve(this.service.wallet.quoteTransfer(query.coins));
  }
}
