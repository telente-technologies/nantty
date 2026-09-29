import { Query } from "@zudojs/cqrs";

import type { CurrencyCode } from "../../../../enums/currency.enum.js";

export class GetReferralSummaryQuery extends Query<"loyalty.getReferralSummary"> {
  public constructor(
    public readonly userId: string,
    public readonly displayCurrency: CurrencyCode,
  ) {
    super("loyalty.getReferralSummary");
  }
}
