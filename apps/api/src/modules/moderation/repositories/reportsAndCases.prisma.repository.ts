import { isUniqueConstraintViolation } from "../../../databases/prisma.database.js";
import type { ModerationCase, ModerationReport } from "../../../generated/prisma/client.js";
import { prisma } from "../../../integrations/database.integration.js";
import type { ModerationTargetType } from "../../../interfaces/moderationTargets.interface.js";
import type { Page, PageRequest } from "../../../types/pagination.type.js";
import { buildPageFromFetchedRows, buildPrismaPageArguments, mapPageItems } from "../../../utils/pagination.util.js";
import {
  createOpenCaseKey,
  type CaseChanges,
  type CaseRecord,
  type CaseSource,
  type CaseStatus,
  type NewCase,
  type NewReport,
  type ReportReason,
  type ReportRecord,
  type ReportStatus,
} from "../models/moderation.model.js";
import type { ModerationCasesRepository, ModerationReportsRepository } from "./reportsAndCases.repository.js";

function convertReportRow(row: ModerationReport): ReportRecord {
  return { ...row, targetType: row.targetType as ModerationTargetType, reason: row.reason as ReportReason, status: row.status as ReportStatus };
}

function convertCaseRow(row: ModerationCase): CaseRecord {
  const { openKey: _openKey, ...rest } = row;
  return { ...rest, targetType: row.targetType as ModerationTargetType, status: row.status as CaseStatus, source: row.source as CaseSource };
}

export class PrismaModerationReportsRepository implements ModerationReportsRepository {
  public async createReport(report: NewReport, now: Date): Promise<{ readonly report: ReportRecord; readonly created: boolean }> {
    try {
      const row = await prisma().moderationReport.create({ data: { ...report, createdAt: now, updatedAt: now } });
      return { report: convertReportRow(row), created: true };
    } catch (error) {
      if (!isUniqueConstraintViolation(error)) throw error;
      const where = { reporterId_targetType_targetId: { reporterId: report.reporterId, targetType: report.targetType, targetId: report.targetId } };
      return { report: convertReportRow(await prisma().moderationReport.findUniqueOrThrow({ where })), created: false };
    }
  }

  public async listReportsByReporter(reporterId: string, limit: number): Promise<readonly ReportRecord[]> {
    return (await prisma().moderationReport.findMany({ where: { reporterId }, orderBy: { createdAt: "desc" }, take: limit })).map(convertReportRow);
  }

  public async listReportsForCase(caseId: string, limit: number): Promise<readonly ReportRecord[]> {
    return (await prisma().moderationReport.findMany({ where: { caseId }, orderBy: { createdAt: "desc" }, take: limit })).map(convertReportRow);
  }

  public countReportsForTargetSince(targetType: ModerationTargetType, targetId: string, since: Date): Promise<number> {
    return prisma().moderationReport.count({ where: { targetType, targetId, createdAt: { gte: since } } });
  }

  public async updateReportsForCase(caseId: string, status: ReportStatus, outcomeNote: string | null, now: Date): Promise<void> {
    await prisma().moderationReport.updateMany({ where: { caseId }, data: { status, outcomeNote, updatedAt: now } });
  }
}

export class PrismaModerationCasesRepository implements ModerationCasesRepository {
  public async findOpenCase(targetType: ModerationTargetType, targetId: string): Promise<CaseRecord | undefined> {
    const row = await prisma().moderationCase.findUnique({ where: { openKey: createOpenCaseKey(targetType, targetId) } });
    return row === null ? undefined : convertCaseRow(row);
  }

  public async openCase(newCase: NewCase, now: Date): Promise<CaseRecord> {
    const openKey = createOpenCaseKey(newCase.targetType, newCase.targetId);
    try {
      return convertCaseRow(await prisma().moderationCase.create({ data: { ...newCase, openKey, createdAt: now, updatedAt: now } }));
    } catch (error) {
      if (!isUniqueConstraintViolation(error)) throw error;
      return convertCaseRow(await prisma().moderationCase.findUniqueOrThrow({ where: { openKey } }));
    }
  }

  public async findById(caseId: string): Promise<CaseRecord | undefined> {
    const row = await prisma().moderationCase.findUnique({ where: { id: caseId } });
    return row === null ? undefined : convertCaseRow(row);
  }

  public async recordAdditionalReport(caseId: string, now: Date): Promise<void> {
    await prisma().moderationCase.updateMany({ where: { id: caseId }, data: { reportCount: { increment: 1 }, updatedAt: now } });
  }

  public async updateCase(caseId: string, changes: CaseChanges, now: Date): Promise<CaseRecord | undefined> {
    const closing = changes.status !== undefined && changes.status !== "open";
    await prisma().moderationCase.updateMany({ where: { id: caseId }, data: { ...changes, ...(closing ? { openKey: null } : {}), updatedAt: now } });
    return this.findById(caseId);
  }

  public async listCases(status: CaseStatus | undefined, page: PageRequest): Promise<Page<CaseRecord>> {
    const rows = await prisma().moderationCase.findMany({
      where: status === undefined ? {} : { status },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      ...buildPrismaPageArguments(page),
    });
    return mapPageItems(buildPageFromFetchedRows(rows, page), convertCaseRow);
  }
}
