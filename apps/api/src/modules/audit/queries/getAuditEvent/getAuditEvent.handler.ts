import { QueryHandler } from "@zudojs/cqrs";

import { notFound } from "../../../../errors/domain.error.js";
import type { AuditEventRecord } from "../../models/audit.model.js";
import type { AuditService } from "../../services/audit.service.js";
import type { GetAuditEventQuery } from "./getAuditEvent.query.js";

export class GetAuditEventHandler extends QueryHandler<GetAuditEventQuery, AuditEventRecord> {
  public readonly queryType = "audit.getAuditEvent" as const;

  public constructor(private readonly auditService: AuditService) {
    super();
  }

  public async execute(query: GetAuditEventQuery): Promise<AuditEventRecord> {
    const event = await this.auditService.repository.findById(query.id);
    if (event === undefined) throw notFound("Audit event");
    return event;
  }
}
