import { QueryHandler } from "@zudojs/cqrs";

import type { CoinPackDto } from "../../dtos/coins.dto.js";
import type { CoinsServices } from "../../services/coinsServices.service.js";
import type { ListCoinPacksQuery } from "./listCoinPacks.query.js";

export class ListCoinPacksHandler extends QueryHandler<ListCoinPacksQuery, readonly CoinPackDto[]> {
  public readonly queryType = "coins.listCoinPacks" as const;

  public constructor(private readonly service: CoinsServices) {
    super();
  }

  public execute(query: ListCoinPacksQuery): Promise<readonly CoinPackDto[]> {
    return this.service.packs.listPacks(query.displayCurrency, query.includeInactive);
  }
}
