import { Query } from "@zudojs/cqrs";

import type { CurrencyCode } from "../../../../enums/currency.enum.js";

export class FindPreferredPlanCurrencyQuery extends Query<"subscriptions.findPreferredPlanCurrency"> {
  public constructor(
    public readonly storeId: string | undefined,
    public readonly viewerCurrency: CurrencyCode,
  ) {
    super("subscriptions.findPreferredPlanCurrency");
  }
}
