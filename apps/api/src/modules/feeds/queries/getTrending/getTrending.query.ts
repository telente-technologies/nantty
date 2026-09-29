import { Query } from "@zudojs/cqrs";

import type { CurrencyCode } from "../../../../enums/currency.enum.js";
import type { Principal } from "../../../../interfaces/principal.interface.js";
import type { TrendingPostKind } from "../../services/trending.service.js";

export class GetTrendingQuery extends Query<"feeds.getTrending"> {
  public constructor(
    public readonly principal: Principal,
    public readonly trendingKind: TrendingPostKind,
    public readonly country: string | null,
    public readonly limit: number,
    public readonly displayCurrency: CurrencyCode,
  ) {
    super("feeds.getTrending");
  }
}
