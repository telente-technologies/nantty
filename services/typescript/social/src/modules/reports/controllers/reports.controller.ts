import type { Handler } from "../../../types/handlerContext.type.js";
import type { RouteFactory } from "../../../utils/route.util.js";
import type { SubmitReportCommand } from "../commands/submitReport/submitReport.command.js";
import { normaliseReportReason } from "../services/reportReasons.service.js";
import { submitReportBodySchema } from "../validators/reports.validator.js";

export interface ReportsHandlers {
  readonly submitReport: Handler<SubmitReportCommand, { readonly id: string; readonly status: "received"; readonly priority: "normal" | "urgent" }>;
}

export function createReportsController(route: RouteFactory, handlers: ReportsHandlers) {
  return {
    submit: route({ authentication: "required", body: submitReportBodySchema, successStatus: 201 }, ({ principal, body }) =>
      handlers.submitReport({
        reporterId: principal.accountId, targetType: body.targetType, targetId: body.targetId, conversationId: body.conversationId, reportedUserId: body.reportedUserId,
        reason: normaliseReportReason(body.reason), details: body.details ?? "", blockReportedUser: body.blockReportedUser ?? false, evidence: body.evidence ?? [], evidenceSelection: body.evidenceSelection, evidenceHash: body.evidenceHash, liveContext: body.liveContext,
      })),
  };
}
