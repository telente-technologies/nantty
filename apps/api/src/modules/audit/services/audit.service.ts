import type { AuditEntry, AuditRecorder } from "../../../interfaces/audit.interface.js";
import type { Clock } from "../../../interfaces/clock.interface.js";
import type { AuditRepository } from "../repositories/audit.repository.js";

export class AuditService implements AuditRecorder {
  public constructor(public readonly repository: AuditRepository, private readonly clock: Clock) {}

  public async record(entry: AuditEntry): Promise<void> {
    await this.repository.append(entry, this.clock.now());
  }
}
