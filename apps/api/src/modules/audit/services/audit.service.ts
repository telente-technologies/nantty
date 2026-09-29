import type { AuditEntry, AuditRecorder } from "../../../interfaces/audit.interface.js";
import type { Clock } from "../../../interfaces/clock.interface.js";
import type { AuditRepository } from "../repositories/audit.repository.js";
import { findAuditRequestContext } from "./auditRequestContext.service.js";

function enrichWithRequestContext(entry: AuditEntry): AuditEntry {
  const context = findAuditRequestContext();
  if (context === undefined) return entry;
  context.recordedEntries += 1;
  const isContextActor = entry.actorId === context.actorId;
  return {
    ...entry,
    ...(entry.ip === undefined && context.ip !== null ? { ip: context.ip } : {}),
    ...(entry.requestId === undefined && context.requestId !== null ? { requestId: context.requestId } : {}),
    stepUpVerified: entry.stepUpVerified ?? context.stepUpVerified,
    ...(isContextActor
      ? {
          actorKind: entry.actorKind ?? context.actorKind,
          actorName: entry.actorName ?? context.actorName,
          ...(context.actorRole === null || entry.actorRole !== undefined ? {} : { actorRole: context.actorRole }),
        }
      : {}),
  };
}

export class AuditService implements AuditRecorder {
  public constructor(public readonly repository: AuditRepository, private readonly clock: Clock) {}

  public async record(entry: AuditEntry): Promise<void> {
    await this.repository.append(enrichWithRequestContext(entry), this.clock.now());
  }
}
