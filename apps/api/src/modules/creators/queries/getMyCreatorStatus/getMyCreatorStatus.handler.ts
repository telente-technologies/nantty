import { QueryHandler } from "@zudojs/cqrs";

import type { CreatorProgramServices } from "../../services/creatorProgramServices.service.js";
import type { CreatorProgramStatusView } from "../../services/creators.service.js";
import type { GetMyCreatorStatusQuery } from "./getMyCreatorStatus.query.js";

export class GetMyCreatorStatusHandler extends QueryHandler<GetMyCreatorStatusQuery, CreatorProgramStatusView> {
  public readonly queryType = "creators.getMyCreatorStatus" as const;

  public constructor(private readonly services: CreatorProgramServices) {
    super();
  }

  public execute(query: GetMyCreatorStatusQuery): Promise<CreatorProgramStatusView> {
    return this.services.creators.findProgramStatus(query.userId);
  }
}
