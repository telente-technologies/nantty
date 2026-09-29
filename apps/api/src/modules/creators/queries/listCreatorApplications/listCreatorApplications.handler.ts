import { QueryHandler } from "@zudojs/cqrs";

import type { Page } from "../../../../types/pagination.type.js";
import { mapPageItems } from "../../../../utils/pagination.util.js";
import type { CreatorApplicationDto } from "../../dtos/creators.dto.js";
import type { CreatorProgramServices } from "../../services/creatorProgramServices.service.js";
import { presentCreatorApplication } from "../../services/creators.service.js";
import type { ListCreatorApplicationsQuery } from "./listCreatorApplications.query.js";

export class ListCreatorApplicationsHandler extends QueryHandler<ListCreatorApplicationsQuery, Page<CreatorApplicationDto>> {
  public readonly queryType = "creators.listCreatorApplications" as const;

  public constructor(private readonly services: CreatorProgramServices) {
    super();
  }

  public async execute(query: ListCreatorApplicationsQuery): Promise<Page<CreatorApplicationDto>> {
    return mapPageItems(await this.services.creators.dependencies.program.listApplications(query.status, query.page), presentCreatorApplication);
  }
}
