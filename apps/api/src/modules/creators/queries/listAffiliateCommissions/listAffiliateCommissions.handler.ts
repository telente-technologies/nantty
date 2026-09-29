import { QueryHandler } from "@zudojs/cqrs";

import type { AffiliateCommissionDto } from "../../dtos/creators.dto.js";
import { presentAffiliateCommission } from "../../services/affiliations.service.js";
import type { CreatorProgramServices } from "../../services/creatorProgramServices.service.js";
import type { ListAffiliateCommissionsQuery } from "./listAffiliateCommissions.query.js";

export class ListAffiliateCommissionsHandler extends QueryHandler<ListAffiliateCommissionsQuery, readonly AffiliateCommissionDto[]> {
  public readonly queryType = "creators.listAffiliateCommissions" as const;

  public constructor(private readonly services: CreatorProgramServices) {
    super();
  }

  public async execute(query: ListAffiliateCommissionsQuery): Promise<readonly AffiliateCommissionDto[]> {
    const { storeId } = await this.services.affiliations.resolveSellerCommissionTarget(query.principal, { ...(query.target.storeId === undefined ? {} : { storeId: query.target.storeId }) });
    return (await this.services.creators.dependencies.affiliates.listCommissionsForStore(storeId)).map(presentAffiliateCommission);
  }
}
