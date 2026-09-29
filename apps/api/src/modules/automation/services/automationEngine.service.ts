import type { Clock } from "../../../interfaces/clock.interface.js";
import type { AppLogger } from "../../../loggers/app.logger.js";
import type { AutomationEvent, AutomationRuleRecord, ExecutionStatus, ExecutionStep } from "../models/automation.model.js";
import type { AutomationExecutionsRepository, AutomationRulesRepository } from "../repositories/automation.repository.js";
import type { AutomationActionRunner } from "./automationActions.service.js";
import { evaluateCondition } from "./conditionEvaluator.service.js";

const ONE_HOUR_IN_MILLISECONDS = 3_600_000;

export interface AutomationEngineDependencies {
  readonly rules: AutomationRulesRepository;
  readonly executions: AutomationExecutionsRepository;
  readonly actions: AutomationActionRunner;
  readonly clock: Clock;
  readonly logger: AppLogger;
}

export class AutomationEngine {
  public constructor(public readonly dependencies: AutomationEngineDependencies) {}

  public async handleEvent(event: AutomationEvent): Promise<void> {
    const { rules, executions, clock, logger } = this.dependencies;
    await executions.recordEventOccurrence(event.trigger, event.subjectKey, clock.now());
    for (const rule of await rules.listEnabledRulesForTrigger(event.trigger)) {
      try {
        await this.evaluateRule(rule, event);
      } catch (error) {
        logger.error("An automation rule could not be evaluated", { ruleId: rule.id, error: error instanceof Error ? error.message : String(error) });
      }
    }
  }

  private async evaluateRule(rule: AutomationRuleRecord, event: AutomationEvent): Promise<void> {
    const { executions, clock } = this.dependencies;
    const startedAt = clock.now();
    const steps: ExecutionStep[] = [];
    const finish = (status: ExecutionStatus, error: string | null = null) =>
      executions.recordExecution({ ruleId: rule.id, trigger: event.trigger, subjectKey: event.subjectKey, status, steps, input: event.data, error, startedAt, finishedAt: clock.now() });

    for (const condition of rule.conditions) {
      const passed = evaluateCondition(condition, event.data);
      steps.push({ kind: "condition", name: `${condition.field} ${condition.operator}`, outcome: passed ? "passed" : "failed" });
      if (!passed) return void (await finish("skipped"));
    }
    if (rule.threshold !== null) {
      const since = new Date(startedAt.getTime() - rule.threshold.withinSeconds * 1000);
      const occurrences = await executions.countEventOccurrencesSince(event.trigger, event.subjectKey, since);
      const reached = occurrences >= rule.threshold.count;
      steps.push({ kind: "threshold", name: `${rule.threshold.count} in ${rule.threshold.withinSeconds}s`, outcome: reached ? "passed" : "failed", detail: `${occurrences} seen` });
      if (!reached) return void (await finish("skipped"));
    }
    const cooldownStart = rule.cooldownSeconds === null ? null : new Date(startedAt.getTime() - rule.cooldownSeconds * 1000);
    if (await executions.hasSucceededForSubjectSince(rule.id, event.subjectKey, cooldownStart)) {
      steps.push({ kind: "cooldown", name: rule.cooldownSeconds === null ? "once per subject" : `${rule.cooldownSeconds}s cooldown`, outcome: "failed" });
      return void (await finish("suppressed"));
    }
    const recentRuns = await executions.countSucceededExecutionsSince(rule.id, new Date(startedAt.getTime() - ONE_HOUR_IN_MILLISECONDS));
    if (recentRuns >= rule.maxExecutionsPerHour) {
      steps.push({ kind: "rate_limit", name: `${rule.maxExecutionsPerHour} per hour`, outcome: "failed" });
      return void (await finish("rate_limited"));
    }
    for (const action of rule.actions) {
      try {
        const detail = await this.dependencies.actions.runAction(rule, action, event.data);
        steps.push({ kind: "action", name: action.type, outcome: "passed", detail });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        steps.push({ kind: "action", name: action.type, outcome: "error", detail: message });
        return void (await finish("failed", message));
      }
    }
    await finish("succeeded");
  }
}
