import { QueryHandler } from "@zudojs/cqrs";

import type { VerificationRecord } from "../../models/verifications.model.js";
import type { VerificationsService } from "../../services/verifications.service.js";
import type { GetVerificationQuery } from "./getVerification.query.js";

export class GetVerificationHandler extends QueryHandler<GetVerificationQuery, VerificationRecord> {
  public readonly queryType = "verifications.getVerification" as const;

  public constructor(private readonly service: VerificationsService) {
    super();
  }

  public execute(query: GetVerificationQuery): Promise<VerificationRecord> {
    return this.service.findByProfileIdOrThrow(query.profileId);
  }
}
