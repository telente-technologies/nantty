import type { AuditRecorder } from "../../../interfaces/audit.interface.js";
import type { Clock } from "../../../interfaces/clock.interface.js";
import type { AutomationRulesRepository, AutomationExecutionsRepository } from "../repositories/automation.repository.js";

export interface AutomationRulesDependencies {
  readonly rules: AutomationRulesRepository;
  readonly executions: AutomationExecutionsRepository;
  readonly audit: AuditRecorder;
  readonly clock: Clock;
  readonly defaultExecutionsPerHour: number;
}

export class AutomationRulesService {
  public constructor(public readonly dependencies: AutomationRulesDependencies) {}
}
