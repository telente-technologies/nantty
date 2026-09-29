import { Command } from "@zudojs/cqrs";

import type { AuditEventFilter } from "../../../audit/models/audit.model.js";
import type { StaffRequestState } from "../../services/staffRequestGuard.service.js";

export class ExportAdminAuditLogCommand extends Command<"admin.exportAdminAuditLog"> {
  public constructor(
    public readonly staff: StaffRequestState,
    public readonly filter: AuditEventFilter,
  ) {
    super("admin.exportAdminAuditLog");
  }
}
