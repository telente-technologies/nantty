import { QueryHandler } from "@zudojs/cqrs";

import type { AdminServices } from "../../services/adminServices.service.js";
import { adminError } from "../../../../utils/adminHttp.util.js";
import { convertAuditEventToLogEntry, type AuditLogEntryDto } from "../../../audit/dtos/auditLogEntry.dto.js";
import type { GetAdminAuditEntryQuery } from "./getAdminAuditEntry.query.js";

export class GetAdminAuditEntryHandler extends QueryHandler<GetAdminAuditEntryQuery, AuditLogEntryDto> {
  public readonly queryType = "admin.getAdminAuditEntry" as const;

  public constructor(private readonly service: AdminServices) {
    super();
  }

  public async execute(query: GetAdminAuditEntryQuery): Promise<AuditLogEntryDto> {
    const entry = await this.service.staff.dependencies.auditLog.findById(query.entryId);
    if (entry === undefined) throw adminError(404, "NOT_FOUND", "Audit entry was not found.");
    return convertAuditEventToLogEntry(entry);
  }
}
