import { Query } from "@zudojs/cqrs";

import type { CurrencyCode } from "../../../../enums/currency.enum.js";

export class GetLoyaltySummaryQuery extends Query<"loyalty.getLoyaltySummary"> {
  public constructor(
    public readonly userId: string,
    public readonly displayCurrency: CurrencyCode,
  ) {
    super("loyalty.getLoyaltySummary");
  }
}
