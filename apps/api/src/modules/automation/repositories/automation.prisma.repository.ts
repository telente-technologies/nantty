import { Prisma, type AutomationExecution, type AutomationRule } from "../../../generated/prisma/client.js";
import { prisma } from "../../../integrations/database.integration.js";
import type { Page, PageRequest } from "../../../types/pagination.type.js";
import { buildPageFromFetchedRows, buildPrismaPageArguments, mapPageItems } from "../../../utils/pagination.util.js";
import type {
  AutomationEventData,
  AutomationExecutionRecord,
  AutomationRuleChanges,
  AutomationRuleRecord,
  AutomationTrigger,
  ExecutionStatus,
  ExecutionStep,
  NewAutomationExecution,
  NewAutomationRule,
  RuleAction,
  RuleCondition,
  RuleThreshold,
} from "../models/automation.model.js";
import type { AutomationExecutionsRepository, AutomationRulesRepository } from "./automation.repository.js";

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function convertRuleRow(row: AutomationRule): AutomationRuleRecord {
  return {
    ...row,
    trigger: row.trigger as AutomationTrigger,
    conditions: row.conditions as unknown as RuleCondition[],
    actions: row.actions as unknown as RuleAction[],
    threshold: (row.threshold ?? null) as unknown as RuleThreshold | null,
  };
}

function convertExecutionRow(row: AutomationExecution): AutomationExecutionRecord {
  return {
    ...row,
    trigger: row.trigger as AutomationTrigger,
    status: row.status as ExecutionStatus,
    steps: row.steps as unknown as ExecutionStep[],
    input: row.input as unknown as AutomationEventData,
  };
}

function convertRuleChanges(changes: AutomationRuleChanges): Prisma.AutomationRuleUpdateInput {
  const { conditions, actions, threshold, ...plain } = changes;
  return {
    ...plain,
    ...(conditions === undefined ? {} : { conditions: toJson(conditions) }),
    ...(actions === undefined ? {} : { actions: toJson(actions) }),
    ...(threshold === undefined ? {} : { threshold: threshold === null ? Prisma.DbNull : toJson(threshold) }),
  };
}

export class PrismaAutomationRulesRepository implements AutomationRulesRepository {
  public async createRule(rule: NewAutomationRule, now: Date): Promise<AutomationRuleRecord> {
    const { conditions, actions, threshold, ...plain } = rule;
    const row = await prisma().automationRule.create({
      data: { ...plain, conditions: toJson(conditions), actions: toJson(actions), ...(threshold === null ? {} : { threshold: toJson(threshold) }), createdAt: now, updatedAt: now },
    });
    return convertRuleRow(row);
  }

  public async updateRule(ruleId: string, changes: AutomationRuleChanges, now: Date): Promise<AutomationRuleRecord | undefined> {
    const existing = await prisma().automationRule.findUnique({ where: { id: ruleId } });
    if (existing === null) return undefined;
    return convertRuleRow(await prisma().automationRule.update({ where: { id: ruleId }, data: { ...convertRuleChanges(changes), updatedAt: now } }));
  }

  public async deleteRule(ruleId: string): Promise<boolean> {
    return (await prisma().automationRule.deleteMany({ where: { id: ruleId } })).count > 0;
  }

  public async findRule(ruleId: string): Promise<AutomationRuleRecord | undefined> {
    const row = await prisma().automationRule.findUnique({ where: { id: ruleId } });
    return row === null ? undefined : convertRuleRow(row);
  }

  public async listRules(): Promise<readonly AutomationRuleRecord[]> {
    return (await prisma().automationRule.findMany({ orderBy: { createdAt: "asc" }, take: 500 })).map(convertRuleRow);
  }

  public async listEnabledRulesForTrigger(trigger: AutomationTrigger): Promise<readonly AutomationRuleRecord[]> {
    return (await prisma().automationRule.findMany({ where: { trigger, enabled: true }, orderBy: { createdAt: "asc" } })).map(convertRuleRow);
  }
}

export class PrismaAutomationExecutionsRepository implements AutomationExecutionsRepository {
  public async recordExecution(execution: NewAutomationExecution): Promise<AutomationExecutionRecord> {
    const row = await prisma().automationExecution.create({ data: { ...execution, steps: toJson(execution.steps), input: toJson(execution.input) } });
    return convertExecutionRow(row);
  }

  public async listExecutionsForRule(ruleId: string, page: PageRequest): Promise<Page<AutomationExecutionRecord>> {
    const rows = await prisma().automationExecution.findMany({ where: { ruleId }, orderBy: [{ startedAt: "desc" }, { id: "desc" }], ...buildPrismaPageArguments(page) });
    return mapPageItems(buildPageFromFetchedRows(rows, page), convertExecutionRow);
  }

  public countSucceededExecutionsSince(ruleId: string, since: Date): Promise<number> {
    return prisma().automationExecution.count({ where: { ruleId, status: "succeeded", startedAt: { gte: since } } });
  }

  public async hasSucceededForSubjectSince(ruleId: string, subjectKey: string, since: Date | null): Promise<boolean> {
    const found = await prisma().automationExecution.findFirst({
      where: { ruleId, subjectKey, status: "succeeded", ...(since === null ? {} : { startedAt: { gte: since } }) },
      select: { id: true },
    });
    return found !== null;
  }

  public async recordEventOccurrence(trigger: AutomationTrigger, subjectKey: string, occurredAt: Date): Promise<void> {
    await prisma().automationEventOccurrence.create({ data: { trigger, subjectKey, occurredAt } });
  }

  public countEventOccurrencesSince(trigger: AutomationTrigger, subjectKey: string, since: Date): Promise<number> {
    return prisma().automationEventOccurrence.count({ where: { trigger, subjectKey, occurredAt: { gte: since } } });
  }

  public async deleteEventOccurrencesBefore(before: Date): Promise<number> {
    return (await prisma().automationEventOccurrence.deleteMany({ where: { occurredAt: { lt: before } } })).count;
  }
}
