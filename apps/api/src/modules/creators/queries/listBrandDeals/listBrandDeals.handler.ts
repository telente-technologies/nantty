import { QueryHandler } from "@zudojs/cqrs";

import type { BrandDealDto } from "../../dtos/creators.dto.js";
import type { CreatorProgramServices } from "../../services/creatorProgramServices.service.js";
import type { Page } from "../../../../types/pagination.type.js";
import type { ListBrandDealsQuery } from "./listBrandDeals.query.js";

export class ListBrandDealsHandler extends QueryHandler<ListBrandDealsQuery, Page<BrandDealDto>> {
  public readonly queryType = "creators.listBrandDeals" as const;

  public constructor(private readonly service: CreatorProgramServices) {
    super();
  }

  public execute(query: ListBrandDealsQuery): Promise<Page<BrandDealDto>> {
    return this.service.brandDeals.listBrandDeals(query.creatorId, query.page);
  }
}
