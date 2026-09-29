import { QueryHandler } from "@zudojs/cqrs";

import { notFound } from "../../../../errors/domain.error.js";
import type { CreatorApplicationDto } from "../../dtos/creators.dto.js";
import type { CreatorProgramServices } from "../../services/creatorProgramServices.service.js";
import { presentCreatorApplication } from "../../services/creators.service.js";
import type { GetMyCreatorApplicationQuery } from "./getMyCreatorApplication.query.js";

export class GetMyCreatorApplicationHandler extends QueryHandler<GetMyCreatorApplicationQuery, CreatorApplicationDto> {
  public readonly queryType = "creators.getMyCreatorApplication" as const;

  public constructor(private readonly services: CreatorProgramServices) {
    super();
  }

  public async execute(query: GetMyCreatorApplicationQuery): Promise<CreatorApplicationDto> {
    const application = await this.services.creators.dependencies.program.findLatestApplicationForUser(query.userId);
    if (application === undefined) throw notFound("Creator application");
    return presentCreatorApplication(application);
  }
}
