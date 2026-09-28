import type { AuditEventRecord } from "../models/audit.model.js";

export interface AuditEventDto {
  readonly id: string;
  readonly actorId: string | null;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
}

export function convertAuditEventToDto(event: AuditEventRecord): AuditEventDto {
  return {
    id: event.id,
    actorId: event.actorId,
    action: event.action,
    entityType: event.entityType,
    entityId: event.entityId,
    metadata: event.metadata,
    createdAt: event.createdAt.toISOString(),
  };
}
