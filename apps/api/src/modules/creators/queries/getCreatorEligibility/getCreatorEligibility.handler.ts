import { QueryHandler } from "@zudojs/cqrs";

import type { CreatorEligibility } from "../../models/creators.model.js";
import type { CreatorProgramServices } from "../../services/creatorProgramServices.service.js";
import type { GetCreatorEligibilityQuery } from "./getCreatorEligibility.query.js";

export class GetCreatorEligibilityHandler extends QueryHandler<GetCreatorEligibilityQuery, CreatorEligibility> {
  public readonly queryType = "creators.getCreatorEligibility" as const;

  public constructor(private readonly services: CreatorProgramServices) {
    super();
  }

  public execute(query: GetCreatorEligibilityQuery): Promise<CreatorEligibility> {
    return this.services.eligibility.evaluateEligibility(query.userId);
  }
}
