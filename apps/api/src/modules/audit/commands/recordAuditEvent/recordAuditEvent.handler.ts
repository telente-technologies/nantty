import { CommandHandler } from "@zudojs/cqrs";

import type { AuditService } from "../../services/audit.service.js";
import type { RecordAuditEventCommand } from "./recordAuditEvent.command.js";

export class RecordAuditEventHandler extends CommandHandler<RecordAuditEventCommand, void> {
  public readonly commandType = "audit.recordAuditEvent" as const;

  public constructor(private readonly auditService: AuditService) {
    super();
  }

  public execute(command: RecordAuditEventCommand): Promise<void> {
    return this.auditService.record(command.entry);
  }
}
