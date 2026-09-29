import { readMockDatabase } from "@/mocks/mockDatabase.mock";
import { hasMockStepUp } from "@/mocks/mockGuards.mock";
import { createMockId, readIsoNow } from "@/mocks/mockResponses.mock";
import type { MockRequest } from "@/mocks/mockRouter.mock";
import type { AuditJsonValue, AuditLogEntry, AuditTarget } from "@/types/audit.type";

export interface MockAuditInput {
  readonly action: string;
  readonly area: string;
  readonly target: AuditTarget;
  readonly reason?: string | null;
  readonly before?: unknown;
  readonly after?: unknown;
}

function toAuditJson(value: unknown): AuditJsonValue | null {
  if (value === undefined) return null;
  return JSON.parse(JSON.stringify(value)) as AuditJsonValue;
}

export function recordMockAuditEntry(request: MockRequest, input: MockAuditInput): AuditLogEntry {
  const principal = request.principal;
  const entry: AuditLogEntry = Object.freeze({
    id: createMockId("aud"),
    occurredAt: readIsoNow(),
    actor: principal ? { id: principal.adminId, name: principal.name, kind: "ADMIN" as const, role: principal.role } : { id: "system", name: "System", kind: "SYSTEM" as const, role: null },
    action: input.action,
    area: input.area,
    target: input.target,
    reason: input.reason ?? null,
    before: toAuditJson(input.before),
    after: toAuditJson(input.after),
    ipAddress: request.headers.get("x-forwarded-for") ?? "127.0.0.1",
    requestId: request.headers.get("x-request-id") ?? createMockId("req"),
    stepUpVerified: hasMockStepUp(request),
  });
  readMockDatabase().auditEntries.unshift(entry);
  return entry;
}

export function listMockAuditEntriesForTarget(targetType: string, targetId: string): AuditLogEntry[] {
  return readMockDatabase().auditEntries.filter((entry) => entry.target.type === targetType && entry.target.id === targetId);
}
