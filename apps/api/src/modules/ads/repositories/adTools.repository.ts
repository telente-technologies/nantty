import { randomUUID } from "node:crypto";

import type {
  AdAutomatedRuleChanges,
  AdAutomatedRuleRecord,
  AdConversionEventRecord,
  AdExperimentRecord,
  AdScheduledReportRecord,
  NewAdAutomatedRuleInput,
  NewAdConversionEventInput,
  NewAdExperimentInput,
  NewAdScheduledReportInput,
} from "../models/adTools.model.js";

export interface AdToolsRepository {
  createConversionEvent(input: NewAdConversionEventInput): Promise<AdConversionEventRecord>;
  listConversionEvents(accountId: string): Promise<readonly AdConversionEventRecord[]>;
  updateConversionEvent(eventId: string, changes: Partial<Pick<AdConversionEventRecord, "name" | "status">>): Promise<AdConversionEventRecord>;
  createExperiment(input: NewAdExperimentInput): Promise<AdExperimentRecord>;
  listExperiments(accountId: string): Promise<readonly AdExperimentRecord[]>;
  updateExperiment(experimentId: string, changes: Partial<Pick<AdExperimentRecord, "status" | "result">>): Promise<AdExperimentRecord>;
  createRule(input: NewAdAutomatedRuleInput): Promise<AdAutomatedRuleRecord>;
  listRules(accountId: string): Promise<readonly AdAutomatedRuleRecord[]>;
  listActiveRules(): Promise<readonly AdAutomatedRuleRecord[]>;
  updateRule(ruleId: string, changes: AdAutomatedRuleChanges): Promise<AdAutomatedRuleRecord>;
  deleteRule(ruleId: string): Promise<void>;
  createScheduledReport(input: NewAdScheduledReportInput): Promise<AdScheduledReportRecord>;
  listScheduledReports(accountId: string): Promise<readonly AdScheduledReportRecord[]>;
  listScheduledReportsDueBefore(now: Date): Promise<readonly AdScheduledReportRecord[]>;
  rescheduleReport(reportId: string, nextSendAt: Date): Promise<void>;
  deleteScheduledReport(reportId: string): Promise<void>;
}

function newestFirst<T extends { readonly createdAt: Date; readonly id: string }>(left: T, right: T): number {
  return right.createdAt.getTime() - left.createdAt.getTime() || right.id.localeCompare(left.id);
}

export class InMemoryAdToolsRepository implements AdToolsRepository {
  private readonly conversionEvents = new Map<string, AdConversionEventRecord>();
  private readonly experiments = new Map<string, AdExperimentRecord>();
  private readonly rules = new Map<string, AdAutomatedRuleRecord>();
  private readonly reports = new Map<string, AdScheduledReportRecord>();

  public async createConversionEvent(input: NewAdConversionEventInput): Promise<AdConversionEventRecord> {
    return this.store(this.conversionEvents, { ...input, id: randomUUID() });
  }

  public async listConversionEvents(accountId: string): Promise<readonly AdConversionEventRecord[]> {
    return [...this.conversionEvents.values()].filter((event) => event.accountId === accountId).sort(newestFirst);
  }

  public async updateConversionEvent(eventId: string, changes: Partial<Pick<AdConversionEventRecord, "name" | "status">>): Promise<AdConversionEventRecord> {
    return this.store(this.conversionEvents, { ...this.require(this.conversionEvents, eventId), ...changes });
  }

  public async createExperiment(input: NewAdExperimentInput): Promise<AdExperimentRecord> {
    return this.store(this.experiments, { ...input, id: randomUUID() });
  }

  public async listExperiments(accountId: string): Promise<readonly AdExperimentRecord[]> {
    return [...this.experiments.values()].filter((experiment) => experiment.accountId === accountId).sort(newestFirst);
  }

  public async updateExperiment(experimentId: string, changes: Partial<Pick<AdExperimentRecord, "status" | "result">>): Promise<AdExperimentRecord> {
    return this.store(this.experiments, { ...this.require(this.experiments, experimentId), ...changes });
  }

  public async createRule(input: NewAdAutomatedRuleInput): Promise<AdAutomatedRuleRecord> {
    return this.store(this.rules, { ...input, id: randomUUID(), lastRunAt: null, lastTriggeredAt: null, triggerCount: 0 });
  }

  public async listRules(accountId: string): Promise<readonly AdAutomatedRuleRecord[]> {
    return [...this.rules.values()].filter((rule) => rule.accountId === accountId).sort(newestFirst);
  }

  public async listActiveRules(): Promise<readonly AdAutomatedRuleRecord[]> {
    return [...this.rules.values()].filter((rule) => rule.status === "active");
  }

  public async updateRule(ruleId: string, changes: AdAutomatedRuleChanges): Promise<AdAutomatedRuleRecord> {
    return this.store(this.rules, { ...this.require(this.rules, ruleId), ...changes });
  }

  public async deleteRule(ruleId: string): Promise<void> {
    this.rules.delete(ruleId);
  }

  public async createScheduledReport(input: NewAdScheduledReportInput): Promise<AdScheduledReportRecord> {
    return this.store(this.reports, { ...input, id: randomUUID() });
  }

  public async listScheduledReports(accountId: string): Promise<readonly AdScheduledReportRecord[]> {
    return [...this.reports.values()].filter((report) => report.accountId === accountId).sort(newestFirst);
  }

  public async listScheduledReportsDueBefore(now: Date): Promise<readonly AdScheduledReportRecord[]> {
    return [...this.reports.values()].filter((report) => report.nextSendAt <= now);
  }

  public async rescheduleReport(reportId: string, nextSendAt: Date): Promise<void> {
    const report = this.reports.get(reportId);
    if (report !== undefined) this.reports.set(reportId, { ...report, nextSendAt });
  }

  public async deleteScheduledReport(reportId: string): Promise<void> {
    this.reports.delete(reportId);
  }

  private store<T extends { readonly id: string }>(map: Map<string, T>, record: T): T {
    map.set(record.id, record);
    return record;
  }

  private require<T>(map: Map<string, T>, id: string): T {
    const record = map.get(id);
    if (record === undefined) throw new Error(`Ads tools record ${id} does not exist.`);
    return record;
  }
}
