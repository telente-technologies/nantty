import { randomUUID } from "node:crypto";

import type { Page, PageRequest } from "../../../types/pagination.type.js";
import { paginateSortedItems } from "../../../utils/pagination.util.js";
import type {
  AutomationExecutionRecord,
  AutomationRuleChanges,
  AutomationRuleRecord,
  AutomationTrigger,
  NewAutomationExecution,
  NewAutomationRule,
} from "../models/automation.model.js";

export interface AutomationRulesRepository {
  createRule(rule: NewAutomationRule, now: Date): Promise<AutomationRuleRecord>;
  updateRule(ruleId: string, changes: AutomationRuleChanges, now: Date): Promise<AutomationRuleRecord | undefined>;
  deleteRule(ruleId: string): Promise<boolean>;
  findRule(ruleId: string): Promise<AutomationRuleRecord | undefined>;
  listRules(): Promise<readonly AutomationRuleRecord[]>;
  listEnabledRulesForTrigger(trigger: AutomationTrigger): Promise<readonly AutomationRuleRecord[]>;
}

export interface AutomationExecutionsRepository {
  recordExecution(execution: NewAutomationExecution): Promise<AutomationExecutionRecord>;
  listExecutionsForRule(ruleId: string, page: PageRequest): Promise<Page<AutomationExecutionRecord>>;
  countSucceededExecutionsSince(ruleId: string, since: Date): Promise<number>;
  hasSucceededForSubjectSince(ruleId: string, subjectKey: string, since: Date | null): Promise<boolean>;
  recordEventOccurrence(trigger: AutomationTrigger, subjectKey: string, occurredAt: Date): Promise<void>;
  countEventOccurrencesSince(trigger: AutomationTrigger, subjectKey: string, since: Date): Promise<number>;
  deleteEventOccurrencesBefore(before: Date): Promise<number>;
}

export class InMemoryAutomationRulesRepository implements AutomationRulesRepository {
  private readonly rules = new Map<string, AutomationRuleRecord>();

  public async createRule(rule: NewAutomationRule, now: Date): Promise<AutomationRuleRecord> {
    const record: AutomationRuleRecord = { ...rule, id: randomUUID(), createdAt: now, updatedAt: now };
    this.rules.set(record.id, record);
    return record;
  }

  public async updateRule(ruleId: string, changes: AutomationRuleChanges, now: Date): Promise<AutomationRuleRecord | undefined> {
    const existing = this.rules.get(ruleId);
    if (existing === undefined) return undefined;
    const updated = { ...existing, ...changes, updatedAt: now };
    this.rules.set(ruleId, updated);
    return updated;
  }

  public async deleteRule(ruleId: string): Promise<boolean> {
    return this.rules.delete(ruleId);
  }

  public async findRule(ruleId: string): Promise<AutomationRuleRecord | undefined> {
    return this.rules.get(ruleId);
  }

  public async listRules(): Promise<readonly AutomationRuleRecord[]> {
    return [...this.rules.values()].sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
  }

  public async listEnabledRulesForTrigger(trigger: AutomationTrigger): Promise<readonly AutomationRuleRecord[]> {
    return (await this.listRules()).filter((rule) => rule.enabled && rule.trigger === trigger);
  }
}

export class InMemoryAutomationExecutionsRepository implements AutomationExecutionsRepository {
  private readonly executions: AutomationExecutionRecord[] = [];
  private readonly occurrences: { readonly trigger: AutomationTrigger; readonly subjectKey: string; readonly occurredAt: Date }[] = [];

  public async recordExecution(execution: NewAutomationExecution): Promise<AutomationExecutionRecord> {
    const record: AutomationExecutionRecord = { ...execution, id: randomUUID() };
    this.executions.push(record);
    return record;
  }

  public async listExecutionsForRule(ruleId: string, page: PageRequest): Promise<Page<AutomationExecutionRecord>> {
    const matching = this.executions.filter((execution) => execution.ruleId === ruleId).sort((left, right) => right.startedAt.getTime() - left.startedAt.getTime());
    return paginateSortedItems(matching, page);
  }

  public async countSucceededExecutionsSince(ruleId: string, since: Date): Promise<number> {
    return this.executions.filter((execution) => execution.ruleId === ruleId && execution.status === "succeeded" && execution.startedAt >= since).length;
  }

  public async hasSucceededForSubjectSince(ruleId: string, subjectKey: string, since: Date | null): Promise<boolean> {
    return this.executions.some(
      (execution) => execution.ruleId === ruleId && execution.subjectKey === subjectKey && execution.status === "succeeded" && (since === null || execution.startedAt >= since),
    );
  }

  public async recordEventOccurrence(trigger: AutomationTrigger, subjectKey: string, occurredAt: Date): Promise<void> {
    this.occurrences.push({ trigger, subjectKey, occurredAt });
  }

  public async countEventOccurrencesSince(trigger: AutomationTrigger, subjectKey: string, since: Date): Promise<number> {
    return this.occurrences.filter((occurrence) => occurrence.trigger === trigger && occurrence.subjectKey === subjectKey && occurrence.occurredAt >= since).length;
  }

  public async deleteEventOccurrencesBefore(before: Date): Promise<number> {
    const kept = this.occurrences.filter((occurrence) => occurrence.occurredAt >= before);
    const deleted = this.occurrences.length - kept.length;
    this.occurrences.splice(0, this.occurrences.length, ...kept);
    return deleted;
  }
}
