import { QueryHandler } from "@zudojs/cqrs";

import type { CreatorDashboardDto } from "../../dtos/creators.dto.js";
import type { CreatorProgramServices } from "../../services/creatorProgramServices.service.js";
import type { GetCreatorDashboardQuery } from "./getCreatorDashboard.query.js";

export class GetCreatorDashboardHandler extends QueryHandler<GetCreatorDashboardQuery, CreatorDashboardDto> {
  public readonly queryType = "creators.getCreatorDashboard" as const;

  public constructor(private readonly services: CreatorProgramServices) {
    super();
  }

  public execute(query: GetCreatorDashboardQuery): Promise<CreatorDashboardDto> {
    return this.services.dashboard.buildDashboard(query.userId, query.period);
  }
}
