import { QueryHandler } from "@zudojs/cqrs";

import type { CreatorAffiliationDto } from "../../dtos/creators.dto.js";
import type { CreatorProgramServices } from "../../services/creatorProgramServices.service.js";
import type { ListCreatorAffiliationsQuery } from "./listCreatorAffiliations.query.js";

export class ListCreatorAffiliationsHandler extends QueryHandler<ListCreatorAffiliationsQuery, readonly CreatorAffiliationDto[]> {
  public readonly queryType = "creators.listCreatorAffiliations" as const;

  public constructor(private readonly services: CreatorProgramServices) {
    super();
  }

  public execute(query: ListCreatorAffiliationsQuery): Promise<readonly CreatorAffiliationDto[]> {
    return this.services.affiliations.presentAffiliations(query.userId);
  }
}
