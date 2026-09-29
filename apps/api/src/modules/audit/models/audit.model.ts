import type { AuditActorKind, AuditEntry } from "../../../interfaces/audit.interface.js";

export interface AuditEventRecord extends AuditEntry {
  readonly id: string;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly actorKind: AuditActorKind;
  readonly actorName: string;
  readonly area: string;
  readonly targetLabel: string;
  readonly reason: string;
  readonly stepUpVerified: boolean;
  readonly createdAt: Date;
}

export interface AuditEventFilter {
  readonly entityType?: string;
  readonly entityId?: string;
  readonly actorId?: string;
  readonly action?: string;
  readonly area?: string;
  readonly search?: string;
  readonly from?: Date;
  readonly to?: Date;
}

export function deriveAuditArea(entry: AuditEntry): string {
  if (entry.area !== undefined && entry.area !== "") return entry.area;
  const prefix = entry.action.split(".")[0] ?? "";
  return prefix === "" ? "general" : prefix;
}
