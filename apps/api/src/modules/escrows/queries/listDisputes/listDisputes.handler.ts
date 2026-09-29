import { QueryHandler } from "@zudojs/cqrs";

import type { Page } from "../../../../types/pagination.type.js";
import type { DisputeRecord } from "../../models/escrows.model.js";
import type { DisputesService } from "../../services/disputes.service.js";
import type { ListDisputesQuery } from "./listDisputes.query.js";

export class ListDisputesHandler extends QueryHandler<ListDisputesQuery, Page<DisputeRecord>> {
  public readonly queryType = "escrows.listDisputes" as const;

  public constructor(private readonly service: DisputesService) {
    super();
  }

  public execute(query: ListDisputesQuery): Promise<Page<DisputeRecord>> {
    return this.service.listDisputes(query.status, query.page);
  }
}
