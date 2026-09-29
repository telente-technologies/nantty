import type { AuditEventRecord } from "../models/audit.model.js";

export interface AuditLogEntryDto {
  readonly id: string;
  readonly occurredAt: string;
  readonly actor: { readonly id: string | null; readonly name: string; readonly kind: string; readonly role: string | null };
  readonly action: string;
  readonly area: string;
  readonly target: { readonly type: string; readonly id: string; readonly label: string };
  readonly reason: string;
  readonly before: unknown;
  readonly after: unknown;
  readonly ipAddress: string | null;
  readonly requestId: string | null;
  readonly stepUpVerified: boolean;
}

export function convertAuditEventToLogEntry(event: AuditEventRecord): AuditLogEntryDto {
  return {
    id: event.id,
    occurredAt: event.createdAt.toISOString(),
    actor: { id: event.actorId, name: event.actorName || (event.actorKind === "SYSTEM" ? "System" : ""), kind: event.actorKind, role: event.actorRole ?? null },
    action: event.action,
    area: event.area,
    target: { type: event.entityType, id: event.entityId, label: event.targetLabel || event.entityId },
    reason: event.reason,
    before: event.before ?? null,
    after: event.after ?? null,
    ipAddress: event.ip ?? null,
    requestId: event.requestId ?? null,
    stepUpVerified: event.stepUpVerified,
  };
}

const FORMULA_PREFIXES = ["=", "+", "-", "@"];

function escapeCsvCell(value: string): string {
  const safe = FORMULA_PREFIXES.some((prefix) => value.startsWith(prefix)) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function convertAuditLogEntriesToCsv(entries: readonly AuditLogEntryDto[]): string {
  const header = ["id", "occurredAt", "actorId", "actorName", "actorKind", "actorRole", "action", "area", "targetType", "targetId", "targetLabel", "reason", "ipAddress", "requestId", "stepUpVerified", "before", "after"];
  const rows = entries.map((entry) =>
    [
      entry.id, entry.occurredAt, entry.actor.id ?? "", entry.actor.name, entry.actor.kind, entry.actor.role ?? "", entry.action, entry.area,
      entry.target.type, entry.target.id, entry.target.label, entry.reason, entry.ipAddress ?? "", entry.requestId ?? "", String(entry.stepUpVerified),
      entry.before === null ? "" : JSON.stringify(entry.before), entry.after === null ? "" : JSON.stringify(entry.after),
    ].map(escapeCsvCell).join(","),
  );
  return `${[header.join(","), ...rows].join("\r\n")}\r\n`;
}
