import { QueryHandler } from "@zudojs/cqrs";

import type { LoyaltyServices } from "../../services/loyaltyServices.service.js";
import type { LoyaltySummaryDto } from "../../dtos/loyalty.dto.js";
import type { GetLoyaltySummaryQuery } from "./getLoyaltySummary.query.js";

export class GetLoyaltySummaryHandler extends QueryHandler<GetLoyaltySummaryQuery, LoyaltySummaryDto> {
  public readonly queryType = "loyalty.getLoyaltySummary" as const;

  public constructor(private readonly service: LoyaltyServices) {
    super();
  }

  public execute(query: GetLoyaltySummaryQuery): Promise<LoyaltySummaryDto> {
    return this.service.summary.buildLoyaltySummary(query.userId, query.displayCurrency);
  }
}
