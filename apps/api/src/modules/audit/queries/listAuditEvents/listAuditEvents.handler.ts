import { QueryHandler } from "@zudojs/cqrs";

import type { Page } from "../../../../types/pagination.type.js";
import type { AuditEventRecord } from "../../models/audit.model.js";
import type { AuditService } from "../../services/audit.service.js";
import type { ListAuditEventsQuery } from "./listAuditEvents.query.js";

export class ListAuditEventsHandler extends QueryHandler<ListAuditEventsQuery, Page<AuditEventRecord>> {
  public readonly queryType = "audit.listAuditEvents" as const;

  public constructor(private readonly auditService: AuditService) {
    super();
  }

  public execute(query: ListAuditEventsQuery): Promise<Page<AuditEventRecord>> {
    return this.auditService.repository.list(query.filter, query.page);
  }
}
