import { QueryHandler } from "@zudojs/cqrs";

import type { CreatorProgramServices } from "../../services/creatorProgramServices.service.js";
import type { CreatorRevenueRulesDto } from "../../dtos/creators.dto.js";
import type { GetCreatorRevenueRulesQuery } from "./getCreatorRevenueRules.query.js";

export class GetCreatorRevenueRulesHandler extends QueryHandler<GetCreatorRevenueRulesQuery, CreatorRevenueRulesDto> {
  public readonly queryType = "creators.getCreatorRevenueRules" as const;

  public constructor(private readonly service: CreatorProgramServices) {
    super();
  }

  public execute(query: GetCreatorRevenueRulesQuery): Promise<CreatorRevenueRulesDto> {
    return Promise.resolve(this.service.cashOut.describeRevenueRules(query.currency));
  }
}
