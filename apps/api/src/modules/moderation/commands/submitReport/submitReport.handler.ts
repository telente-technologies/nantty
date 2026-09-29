import { CommandHandler } from "@zudojs/cqrs";

import { notFound, unprocessable } from "../../../../errors/domain.error.js";
import type { ModerationTargetType } from "../../../../interfaces/moderationTargets.interface.js";
import { publishEvent } from "../../../../loaders/events.loader.js";
import { ModerationReportSubmittedEvent } from "../../events/moderationEvents.event.js";
import type { ModerationService } from "../../services/moderation.service.js";
import type { SubmitReportCommand } from "./submitReport.command.js";

export interface SubmittedReport {
  readonly id: string;
  readonly status: "received";
}

export class SubmitReportHandler extends CommandHandler<SubmitReportCommand, SubmittedReport> {
  public readonly commandType = "moderation.submitReport" as const;

  public constructor(private readonly moderationService: ModerationService) {
    super();
  }

  public async execute(command: SubmitReportCommand): Promise<SubmittedReport> {
    const { targets, reports, cases, audit, events, clock } = this.moderationService.dependencies;
    const reporterId = command.principal.userId;
    const targetType: ModerationTargetType = command.input.targetType === "clip" ? "post" : command.input.targetType;
    const { targetId, reason } = command.input;
    const gateway = targets.requireGateway(targetType);
    const description = await targets.describeTargetOrThrow(targetType, targetId);
    if (gateway.isReportableBy !== undefined && !(await gateway.isReportableBy(targetId, reporterId))) throw notFound("Reported content");
    if (description.ownerUserId === reporterId) throw unprocessable("You cannot report your own content.");
    const caseRecord = await this.moderationService.findOrOpenCase({ targetType, targetId, source: "report", priority: 0, flaggedReason: null });
    const { report, created } = await reports.createReport(
      { reporterId, targetType, targetId, reason, details: command.input.details?.trim() ?? "", caseId: caseRecord.id },
      clock.now(),
    );
    if (!created) return { id: report.id, status: "received" };
    await cases.recordAdditionalReport(caseRecord.id, clock.now());
    await audit.record({ actorId: reporterId, action: "moderation.report_submitted", entityType: targetType, entityId: targetId, metadata: { reportId: report.id, reason } });
    await publishEvent(events, ModerationReportSubmittedEvent, {
      reportId: report.id,
      caseId: caseRecord.id,
      reporterId,
      targetType,
      targetId,
      targetOwnerId: description.ownerUserId,
      reason,
    });
    return { id: report.id, status: "received" };
  }
}
