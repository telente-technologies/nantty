import { QueryHandler } from "@zudojs/cqrs";

import { convertReportToDto, type ContentReportDto } from "../../dtos/moderation.dto.js";
import type { ModerationService } from "../../services/moderation.service.js";
import type { ListMyReportsQuery } from "./listMyReports.query.js";

const MY_REPORTS_LIMIT = 100;

export class ListMyReportsHandler extends QueryHandler<ListMyReportsQuery, readonly ContentReportDto[]> {
  public readonly queryType = "moderation.listMyReports" as const;

  public constructor(private readonly moderationService: ModerationService) {
    super();
  }

  public async execute(query: ListMyReportsQuery): Promise<readonly ContentReportDto[]> {
    const { reports, cases } = this.moderationService.dependencies;
    const mine = await reports.listReportsByReporter(query.principal.userId, MY_REPORTS_LIMIT);
    const labels = new Map<string, string>();
    for (const caseId of new Set(mine.map((report) => report.caseId))) labels.set(caseId, (await cases.findById(caseId))?.targetSummary ?? "");
    return mine.map((report) => convertReportToDto(report, labels.get(report.caseId) ?? ""));
  }
}
