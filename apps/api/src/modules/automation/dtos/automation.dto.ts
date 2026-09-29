import type { AutomationExecutionRecord, AutomationRuleRecord } from "../models/automation.model.js";

export type AutomationRuleDto = Omit<AutomationRuleRecord, "createdAt" | "updatedAt"> & { readonly createdAt: string; readonly updatedAt: string };
export type AutomationExecutionDto = Omit<AutomationExecutionRecord, "startedAt" | "finishedAt"> & { readonly startedAt: string; readonly finishedAt: string };

export function convertRuleToDto(rule: AutomationRuleRecord): AutomationRuleDto {
  return { ...rule, createdAt: rule.createdAt.toISOString(), updatedAt: rule.updatedAt.toISOString() };
}

export function convertExecutionToDto(execution: AutomationExecutionRecord): AutomationExecutionDto {
  return { ...execution, startedAt: execution.startedAt.toISOString(), finishedAt: execution.finishedAt.toISOString() };
}
