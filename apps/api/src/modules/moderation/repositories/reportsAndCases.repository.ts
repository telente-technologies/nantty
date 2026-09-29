import { randomUUID } from "node:crypto";

import type { ModerationTargetType } from "../../../interfaces/moderationTargets.interface.js";
import type { Page, PageRequest } from "../../../types/pagination.type.js";
import { compareByNewestFirst, paginateSortedItems } from "../../../utils/pagination.util.js";
import type { CaseChanges, CaseRecord, CaseStatus, NewCase, NewReport, ReportRecord, ReportStatus } from "../models/moderation.model.js";

export interface ModerationReportsRepository {
  createReport(report: NewReport, now: Date): Promise<{ readonly report: ReportRecord; readonly created: boolean }>;
  listReportsByReporter(reporterId: string, limit: number): Promise<readonly ReportRecord[]>;
  listReportsForCase(caseId: string, limit: number): Promise<readonly ReportRecord[]>;
  countReportsForTargetSince(targetType: ModerationTargetType, targetId: string, since: Date): Promise<number>;
  updateReportsForCase(caseId: string, status: ReportStatus, outcomeNote: string | null, now: Date): Promise<void>;
}

export interface ModerationCasesRepository {
  findOpenCase(targetType: ModerationTargetType, targetId: string): Promise<CaseRecord | undefined>;
  openCase(newCase: NewCase, now: Date): Promise<CaseRecord>;
  findById(caseId: string): Promise<CaseRecord | undefined>;
  recordAdditionalReport(caseId: string, now: Date): Promise<void>;
  updateCase(caseId: string, changes: CaseChanges, now: Date): Promise<CaseRecord | undefined>;
  listCases(status: CaseStatus | undefined, page: PageRequest): Promise<Page<CaseRecord>>;
}

export class InMemoryModerationReportsRepository implements ModerationReportsRepository {
  private readonly reports = new Map<string, ReportRecord>();

  public async createReport(report: NewReport, now: Date): Promise<{ readonly report: ReportRecord; readonly created: boolean }> {
    const existing = [...this.reports.values()].find(
      (candidate) => candidate.reporterId === report.reporterId && candidate.targetType === report.targetType && candidate.targetId === report.targetId,
    );
    if (existing !== undefined) return { report: existing, created: false };
    const record: ReportRecord = { ...report, id: randomUUID(), status: "received", outcomeNote: null, createdAt: now, updatedAt: now };
    this.reports.set(record.id, record);
    return { report: record, created: true };
  }

  public async listReportsByReporter(reporterId: string, limit: number): Promise<readonly ReportRecord[]> {
    return [...this.reports.values()].filter((report) => report.reporterId === reporterId).sort(compareByNewestFirst).slice(0, limit);
  }

  public async listReportsForCase(caseId: string, limit: number): Promise<readonly ReportRecord[]> {
    return [...this.reports.values()].filter((report) => report.caseId === caseId).sort(compareByNewestFirst).slice(0, limit);
  }

  public async countReportsForTargetSince(targetType: ModerationTargetType, targetId: string, since: Date): Promise<number> {
    return [...this.reports.values()].filter((report) => report.targetType === targetType && report.targetId === targetId && report.createdAt >= since).length;
  }

  public async updateReportsForCase(caseId: string, status: ReportStatus, outcomeNote: string | null, now: Date): Promise<void> {
    for (const report of this.reports.values()) {
      if (report.caseId === caseId) this.reports.set(report.id, { ...report, status, outcomeNote, updatedAt: now });
    }
  }
}

export class InMemoryModerationCasesRepository implements ModerationCasesRepository {
  private readonly cases = new Map<string, CaseRecord>();

  public async findOpenCase(targetType: ModerationTargetType, targetId: string): Promise<CaseRecord | undefined> {
    return [...this.cases.values()].find((candidate) => candidate.status === "open" && candidate.targetType === targetType && candidate.targetId === targetId);
  }

  public async openCase(newCase: NewCase, now: Date): Promise<CaseRecord> {
    const existing = await this.findOpenCase(newCase.targetType, newCase.targetId);
    if (existing !== undefined) return existing;
    const record: CaseRecord = {
      ...newCase,
      id: randomUUID(),
      status: "open",
      reportCount: 0,
      autoHidden: false,
      resolvedById: null,
      resolvedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.cases.set(record.id, record);
    return record;
  }

  public async findById(caseId: string): Promise<CaseRecord | undefined> {
    return this.cases.get(caseId);
  }

  public async recordAdditionalReport(caseId: string, now: Date): Promise<void> {
    const existing = this.cases.get(caseId);
    if (existing !== undefined) this.cases.set(caseId, { ...existing, reportCount: existing.reportCount + 1, updatedAt: now });
  }

  public async updateCase(caseId: string, changes: CaseChanges, now: Date): Promise<CaseRecord | undefined> {
    const existing = this.cases.get(caseId);
    if (existing === undefined) return undefined;
    const updated = { ...existing, ...changes, updatedAt: now };
    this.cases.set(caseId, updated);
    return updated;
  }

  public async listCases(status: CaseStatus | undefined, page: PageRequest): Promise<Page<CaseRecord>> {
    const matching = [...this.cases.values()]
      .filter((candidate) => status === undefined || candidate.status === status)
      .sort((left, right) => right.priority - left.priority || compareByNewestFirst(left, right));
    return paginateSortedItems(matching, page);
  }
}
