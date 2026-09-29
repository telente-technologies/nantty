import { QueryHandler } from "@zudojs/cqrs";

import type { CoinBalanceView } from "../../services/coinWallet.service.js";
import type { CoinsServices } from "../../services/coinsServices.service.js";
import type { GetCoinBalanceQuery } from "./getCoinBalance.query.js";

export class GetCoinBalanceHandler extends QueryHandler<GetCoinBalanceQuery, CoinBalanceView> {
  public readonly queryType = "coins.getCoinBalance" as const;

  public constructor(private readonly service: CoinsServices) {
    super();
  }

  public execute(query: GetCoinBalanceQuery): Promise<CoinBalanceView> {
    return this.service.wallet.findBalance(query.userId);
  }
}
