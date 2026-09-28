import { Command } from "@zudojs/cqrs";

import type { AuditEntry } from "../../../../interfaces/audit.interface.js";

export class RecordAuditEventCommand extends Command<"audit.recordAuditEvent"> {
  public constructor(
    public readonly entry: AuditEntry,
  ) {
    super("audit.recordAuditEvent");
  }
}
