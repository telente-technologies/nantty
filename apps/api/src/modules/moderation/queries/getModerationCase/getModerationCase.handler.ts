import { QueryHandler } from "@zudojs/cqrs";

import { notFound } from "../../../../errors/domain.error.js";
import { convertCaseToDto, convertDecisionToDto, type ModerationCaseDetailDto } from "../../dtos/moderation.dto.js";
import type { ModerationService } from "../../services/moderation.service.js";
import type { GetModerationCaseQuery } from "./getModerationCase.query.js";

const CASE_REPORTS_LIMIT = 100;

export class GetModerationCaseHandler extends QueryHandler<GetModerationCaseQuery, ModerationCaseDetailDto> {
  public readonly queryType = "moderation.getModerationCase" as const;

  public constructor(private readonly moderationService: ModerationService) {
    super();
  }

  public async execute(query: GetModerationCaseQuery): Promise<ModerationCaseDetailDto> {
    const { cases, reports, decisions } = this.moderationService.dependencies;
    const caseRecord = await cases.findById(query.caseId);
    if (caseRecord === undefined) throw notFound("Moderation case");
    const [caseReports, caseDecisions] = await Promise.all([reports.listReportsForCase(caseRecord.id, CASE_REPORTS_LIMIT), decisions.listDecisionsForCase(caseRecord.id)]);
    const appeals = await decisions.listAppealsForDecisions(caseDecisions.map((decision) => decision.id));
    return {
      ...convertCaseToDto(caseRecord),
      reports: caseReports.map((report) => ({ id: report.id, reporterId: report.reporterId, reason: report.reason, details: report.details, createdAt: report.createdAt.toISOString() })),
      decisions: caseDecisions.map((decision) => convertDecisionToDto(decision, appeals.find((appeal) => appeal.decisionId === decision.id))),
    };
  }
}
