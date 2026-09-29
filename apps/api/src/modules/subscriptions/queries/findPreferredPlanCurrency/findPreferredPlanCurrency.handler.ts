import { QueryHandler } from "@zudojs/cqrs";

import type { CurrencyCode } from "../../../../enums/currency.enum.js";
import type { SubscriptionBillingService } from "../../services/subscriptionBilling.service.js";
import type { FindPreferredPlanCurrencyQuery } from "./findPreferredPlanCurrency.query.js";

export class FindPreferredPlanCurrencyHandler extends QueryHandler<FindPreferredPlanCurrencyQuery, CurrencyCode> {
  public readonly queryType = "subscriptions.findPreferredPlanCurrency" as const;

  public constructor(private readonly service: SubscriptionBillingService) {
    super();
  }

  public execute(query: FindPreferredPlanCurrencyQuery): Promise<CurrencyCode> {
    return this.service.choosePreferredCurrency(query.storeId, query.viewerCurrency);
  }
}
