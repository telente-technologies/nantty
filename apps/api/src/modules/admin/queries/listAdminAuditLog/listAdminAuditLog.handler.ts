import { QueryHandler } from "@zudojs/cqrs";

import type { AdminServices } from "../../services/adminServices.service.js";
import { convertAuditEventToLogEntry, type AuditLogEntryDto } from "../../../audit/dtos/auditLogEntry.dto.js";
import { mapNumberedPage, type NumberedPage } from "../../../../utils/adminHttp.util.js";
import type { ListAdminAuditLogQuery } from "./listAdminAuditLog.query.js";

export class ListAdminAuditLogHandler extends QueryHandler<ListAdminAuditLogQuery, NumberedPage<AuditLogEntryDto>> {
  public readonly queryType = "admin.listAdminAuditLog" as const;

  public constructor(private readonly service: AdminServices) {
    super();
  }

  public async execute(query: ListAdminAuditLogQuery): Promise<NumberedPage<AuditLogEntryDto>> {
    return mapNumberedPage(await this.service.staff.dependencies.auditLog.listNumbered(query.filter, query.page), convertAuditEventToLogEntry);
  }
}
