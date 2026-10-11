import { recordMockAuditEntry } from "@/mocks/mockAudit.mock";
import { readMockDatabase } from "@/mocks/mockDatabase.mock";
import { requireMockPermission } from "@/mocks/mockGuards.mock";
import { failNotFound, matchesSearchText, paginateByCursor, respondWithDownload, respondWithJson } from "@/mocks/mockResponses.mock";
import { registerMockRoute, type MockRequest } from "@/mocks/mockRouter.mock";
import type { AuditLogEntry } from "@/types/audit.type";

function filterAuditEntries(request: MockRequest): AuditLogEntry[] {
  const search = request.query.get("search");
  const area = request.query.get("area");
  const actorId = request.query.get("actorId");
  const targetType = request.query.get("targetType");
  const targetId = request.query.get("targetId");
  const action = request.query.get("action");
  const requestId = request.query.get("requestId");
  const stepUpOnly = request.query.get("stepUp") === "true";
  const from = request.query.get("from");
  const to = request.query.get("to");
  return readMockDatabase().auditEntries.filter(
    (entry) =>
      matchesSearchText(search, entry.action, entry.actor.name, entry.target.label, entry.target.id, entry.reason) &&
      (!area || entry.area === area) &&
      (!actorId || entry.actor.id === actorId) &&
      (!targetType || entry.target.type === targetType) &&
      (!targetId || entry.target.id === targetId) &&
      (!action || entry.action === action) &&
      (!requestId || entry.requestId === requestId) &&
      (!stepUpOnly || entry.stepUpVerified) &&
      (!from || entry.occurredAt >= from) &&
      (!to || entry.occurredAt <= to),
  );
}

function escapeCsvCell(value: string): string {
  const neutralized = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${neutralized.replace(/"/g, '""')}"`;
}

export function registerAuditLogMockHandlers(): void {
  registerMockRoute("GET", "/admin/audit", (request) => {
    requireMockPermission(request, "audit:read");
    return respondWithJson(200, paginateByCursor(filterAuditEntries(request), request, 50));
  });

  registerMockRoute("GET", "/admin/audit/facets", (request) => {
    requireMockPermission(request, "audit:read");
    const entries = readMockDatabase().auditEntries;
    const actors = new Map(entries.map((entry) => [entry.actor.id, entry.actor.name]));
    return respondWithJson(200, { areas: [...new Set(entries.map((entry) => entry.area))].sort(), actors: [...actors].map(([id, name]) => ({ id, name })) });
  });

  registerMockRoute("GET", "/admin/audit/export", (request) => {
    requireMockPermission(request, "audit:export");
    const entries = filterAuditEntries(request);
    const header = ["occurredAt", "actor", "staffId", "role", "departments", "action", "area", "targetType", "targetId", "targetLabel", "reason", "stepUp", "ipAddress", "requestId", "before", "after"];
    const rows = entries.map((entry) =>
      [entry.occurredAt, entry.actor.name, entry.actor.id, entry.actor.role ?? "", (entry.actor.departments ?? []).join("; "), entry.action, entry.area, entry.target.type, entry.target.id, entry.target.label, entry.reason ?? "", String(entry.stepUpVerified), entry.ipAddress ?? "", entry.requestId, JSON.stringify(entry.before), JSON.stringify(entry.after)]
        .map((cell) => escapeCsvCell(cell))
        .join(","),
    );
    recordMockAuditEntry(request, { action: "audit.exported", area: "audit", target: { type: "auditExport", id: "csv", label: `${entries.length} entries` }, after: Object.fromEntries(request.query) });
    return respondWithDownload(`zudomart-audit-${new Date().toISOString().slice(0, 10)}.csv`, [header.join(","), ...rows].join("\n"), "text/csv; charset=utf-8");
  });

  registerMockRoute("GET", "/admin/audit/:entryId", (request) => {
    requireMockPermission(request, "audit:read");
    const entry = readMockDatabase().auditEntries.find((candidate) => candidate.id === request.params.entryId);
    if (!entry) failNotFound("Audit entry");
    return respondWithJson(200, entry);
  });
}
