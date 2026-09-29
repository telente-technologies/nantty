import { Query } from "@zudojs/cqrs";

import type { CurrencyCode } from "../../../../enums/currency.enum.js";

export class GetCreatorRevenueRulesQuery extends Query<"creators.getCreatorRevenueRules"> {
  public constructor(
    public readonly currency: CurrencyCode,
  ) {
    super("creators.getCreatorRevenueRules");
  }
}
