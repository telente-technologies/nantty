import type { AuditEntry } from "../../../interfaces/audit.interface.js";

export interface AuditEventRecord extends AuditEntry {
  readonly id: string;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly createdAt: Date;
}

export interface AuditEventFilter {
  readonly entityType?: string;
  readonly entityId?: string;
  readonly actorId?: string;
  readonly action?: string;
}
