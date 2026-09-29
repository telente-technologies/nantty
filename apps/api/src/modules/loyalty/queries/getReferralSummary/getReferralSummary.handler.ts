import { QueryHandler } from "@zudojs/cqrs";

import type { LoyaltyServices } from "../../services/loyaltyServices.service.js";
import type { ReferralSummaryDto } from "../../dtos/loyalty.dto.js";
import type { GetReferralSummaryQuery } from "./getReferralSummary.query.js";

export class GetReferralSummaryHandler extends QueryHandler<GetReferralSummaryQuery, ReferralSummaryDto> {
  public readonly queryType = "loyalty.getReferralSummary" as const;

  public constructor(private readonly service: LoyaltyServices) {
    super();
  }

  public execute(query: GetReferralSummaryQuery): Promise<ReferralSummaryDto> {
    return this.service.summary.buildReferralSummary(query.userId, query.displayCurrency);
  }
}
