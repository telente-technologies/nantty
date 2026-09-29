import type { Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../../integrations/database.integration.js";
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
import type { AdToolsRepository } from "./adTools.repository.js";

type ConversionRow = Awaited<ReturnType<ReturnType<typeof prisma>["adConversionEvent"]["create"]>>;
type ExperimentRow = Awaited<ReturnType<ReturnType<typeof prisma>["adExperiment"]["create"]>>;
type RuleRow = Awaited<ReturnType<ReturnType<typeof prisma>["adAutomatedRule"]["create"]>>;
type ReportRow = Awaited<ReturnType<ReturnType<typeof prisma>["adScheduledReport"]["create"]>>;

const toJson = (value: unknown) => value as Prisma.InputJsonValue;
const newestFirst = [{ createdAt: "desc" as const }, { id: "desc" as const }];

function toConversion(row: ConversionRow): AdConversionEventRecord {
  return { ...row, eventType: row.eventType as AdConversionEventRecord["eventType"], status: row.status as AdConversionEventRecord["status"] };
}

function toExperiment(row: ExperimentRow): AdExperimentRecord {
  return {
    ...row,
    variable: row.variable as AdExperimentRecord["variable"],
    metric: row.metric as AdExperimentRecord["metric"],
    status: row.status as AdExperimentRecord["status"],
    arms: row.arms as unknown as AdExperimentRecord["arms"],
    result: row.result as unknown as AdExperimentRecord["result"],
  };
}

function toRule(row: RuleRow): AdAutomatedRuleRecord {
  return {
    ...row,
    status: row.status as AdAutomatedRuleRecord["status"],
    level: row.level as AdAutomatedRuleRecord["level"],
    conditions: row.conditions as unknown as AdAutomatedRuleRecord["conditions"],
    action: row.action as unknown as AdAutomatedRuleRecord["action"],
    checkEveryMinutes: row.checkEveryMinutes as AdAutomatedRuleRecord["checkEveryMinutes"],
  };
}

function toReport(row: ReportRow): AdScheduledReportRecord {
  return { ...row, frequency: row.frequency as AdScheduledReportRecord["frequency"] };
}

export class PrismaAdToolsRepository implements AdToolsRepository {
  public async createConversionEvent(input: NewAdConversionEventInput): Promise<AdConversionEventRecord> {
    return toConversion(await prisma().adConversionEvent.create({ data: input }));
  }

  public async listConversionEvents(accountId: string): Promise<readonly AdConversionEventRecord[]> {
    return (await prisma().adConversionEvent.findMany({ where: { accountId }, orderBy: newestFirst })).map(toConversion);
  }

  public async updateConversionEvent(eventId: string, changes: Partial<Pick<AdConversionEventRecord, "name" | "status">>): Promise<AdConversionEventRecord> {
    return toConversion(await prisma().adConversionEvent.update({ where: { id: eventId }, data: changes }));
  }

  public async createExperiment(input: NewAdExperimentInput): Promise<AdExperimentRecord> {
    const { arms, result, ...rest } = input;
    return toExperiment(await prisma().adExperiment.create({ data: { ...rest, arms: toJson(arms), ...(result === null ? {} : { result: toJson(result) }) } }));
  }

  public async listExperiments(accountId: string): Promise<readonly AdExperimentRecord[]> {
    return (await prisma().adExperiment.findMany({ where: { accountId }, orderBy: newestFirst })).map(toExperiment);
  }

  public async updateExperiment(experimentId: string, changes: Partial<Pick<AdExperimentRecord, "status" | "result">>): Promise<AdExperimentRecord> {
    const { result, ...rest } = changes;
    return toExperiment(await prisma().adExperiment.update({ where: { id: experimentId }, data: { ...rest, ...(result === undefined || result === null ? {} : { result: toJson(result) }) } }));
  }

  public async createRule(input: NewAdAutomatedRuleInput): Promise<AdAutomatedRuleRecord> {
    const { conditions, action, targetIds, ...rest } = input;
    return toRule(await prisma().adAutomatedRule.create({ data: { ...rest, targetIds: [...targetIds], conditions: toJson(conditions), action: toJson(action) } }));
  }

  public async listRules(accountId: string): Promise<readonly AdAutomatedRuleRecord[]> {
    return (await prisma().adAutomatedRule.findMany({ where: { accountId }, orderBy: newestFirst })).map(toRule);
  }

  public async listActiveRules(): Promise<readonly AdAutomatedRuleRecord[]> {
    return (await prisma().adAutomatedRule.findMany({ where: { status: "active" }, take: 5_000 })).map(toRule);
  }

  public async updateRule(ruleId: string, changes: AdAutomatedRuleChanges): Promise<AdAutomatedRuleRecord> {
    const { conditions, action, targetIds, ...rest } = changes;
    const data = {
      ...rest,
      ...(conditions === undefined ? {} : { conditions: toJson(conditions) }),
      ...(action === undefined ? {} : { action: toJson(action) }),
      ...(targetIds === undefined ? {} : { targetIds: [...targetIds] }),
    };
    return toRule(await prisma().adAutomatedRule.update({ where: { id: ruleId }, data }));
  }

  public async deleteRule(ruleId: string): Promise<void> {
    await prisma().adAutomatedRule.deleteMany({ where: { id: ruleId } });
  }

  public async createScheduledReport(input: NewAdScheduledReportInput): Promise<AdScheduledReportRecord> {
    return toReport(await prisma().adScheduledReport.create({ data: { ...input, metrics: [...input.metrics] } }));
  }

  public async listScheduledReports(accountId: string): Promise<readonly AdScheduledReportRecord[]> {
    return (await prisma().adScheduledReport.findMany({ where: { accountId }, orderBy: newestFirst })).map(toReport);
  }

  public async listScheduledReportsDueBefore(now: Date): Promise<readonly AdScheduledReportRecord[]> {
    return (await prisma().adScheduledReport.findMany({ where: { nextSendAt: { lte: now } }, take: 500 })).map(toReport);
  }

  public async rescheduleReport(reportId: string, nextSendAt: Date): Promise<void> {
    await prisma().adScheduledReport.updateMany({ where: { id: reportId }, data: { nextSendAt } });
  }

  public async deleteScheduledReport(reportId: string): Promise<void> {
    await prisma().adScheduledReport.deleteMany({ where: { id: reportId } });
  }
}
