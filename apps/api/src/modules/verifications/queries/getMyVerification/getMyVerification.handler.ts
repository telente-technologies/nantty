import { QueryHandler } from "@zudojs/cqrs";

import type { VerificationRecord } from "../../models/verifications.model.js";
import type { VerificationsService } from "../../services/verifications.service.js";
import type { GetMyVerificationQuery } from "./getMyVerification.query.js";

export class GetMyVerificationHandler extends QueryHandler<GetMyVerificationQuery, VerificationRecord> {
  public readonly queryType = "verifications.getMyVerification" as const;

  public constructor(private readonly service: VerificationsService) {
    super();
  }

  public execute(query: GetMyVerificationQuery): Promise<VerificationRecord> {
    return this.service.findVerificationForPrincipal(query.principal, query.profileType, query.storeId);
  }
}
