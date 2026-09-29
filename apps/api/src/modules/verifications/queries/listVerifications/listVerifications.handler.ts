import { QueryHandler } from "@zudojs/cqrs";

import type { Page } from "../../../../types/pagination.type.js";
import type { VerificationRecord } from "../../models/verifications.model.js";
import type { VerificationsService } from "../../services/verifications.service.js";
import type { ListVerificationsQuery } from "./listVerifications.query.js";

export class ListVerificationsHandler extends QueryHandler<ListVerificationsQuery, Page<VerificationRecord>> {
  public readonly queryType = "verifications.listVerifications" as const;

  public constructor(private readonly service: VerificationsService) {
    super();
  }

  public execute(query: ListVerificationsQuery): Promise<Page<VerificationRecord>> {
    return this.service.listVerifications(query.filter, query.page);
  }
}
