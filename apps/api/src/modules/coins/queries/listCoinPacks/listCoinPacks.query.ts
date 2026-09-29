import { Query } from "@zudojs/cqrs";

import type { CurrencyCode } from "../../../../enums/currency.enum.js";

export class ListCoinPacksQuery extends Query<"coins.listCoinPacks"> {
  public constructor(
    public readonly displayCurrency: CurrencyCode,
    public readonly includeInactive: boolean,
  ) {
    super("coins.listCoinPacks");
  }
}
