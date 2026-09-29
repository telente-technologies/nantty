import { CommandHandler } from "@zudojs/cqrs";

import type { AdminServices } from "../../services/adminServices.service.js";
import { convertAuditEventToLogEntry, convertAuditLogEntriesToCsv } from "../../../audit/dtos/auditLogEntry.dto.js";
import type { ExportAdminAuditLogCommand } from "./exportAdminAuditLog.command.js";

export class ExportAdminAuditLogHandler extends CommandHandler<ExportAdminAuditLogCommand, string> {
  public readonly commandType = "admin.exportAdminAuditLog" as const;

  public constructor(private readonly service: AdminServices) {
    super();
  }

  public async execute(command: ExportAdminAuditLogCommand): Promise<string> {
    const { auditLog } = this.service.staff.dependencies;
    const found = await auditLog.listNumbered(command.filter, { page: 1, pageSize: 10_000 });
    await this.service.staff.recordAudit({ actorId: command.staff.account.id, action: "audit.exported", area: "audit", entityType: "audit_log", entityId: "export", metadata: { rows: found.items.length, filter: { ...command.filter } } });
    return convertAuditLogEntriesToCsv(found.items.map(convertAuditEventToLogEntry));
  }
}
