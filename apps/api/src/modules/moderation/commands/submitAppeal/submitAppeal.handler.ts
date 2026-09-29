import { CommandHandler } from "@zudojs/cqrs";

import { invalidState, notFound, unprocessable } from "../../../../errors/domain.error.js";
import { convertAppealToDto, type AppealDto } from "../../dtos/moderation.dto.js";
import type { ModerationService } from "../../services/moderation.service.js";
import type { SubmitAppealCommand } from "./submitAppeal.command.js";

export class SubmitAppealHandler extends CommandHandler<SubmitAppealCommand, AppealDto> {
  public readonly commandType = "moderation.submitAppeal" as const;

  public constructor(private readonly moderationService: ModerationService) {
    super();
  }

  public async execute(command: SubmitAppealCommand): Promise<AppealDto> {
    const { decisions, audit, clock } = this.moderationService.dependencies;
    const appellantId = command.principal.userId;
    const decision = await decisions.findDecision(command.decisionId);
    if (decision === undefined || decision.affectedUserId !== appellantId) throw notFound("Moderation decision");
    if (decision.action === "dismiss") throw unprocessable("There is nothing to appeal.");
    if (decision.reversedAt !== null) throw invalidState("This decision was already reversed.");
    const appeal = await decisions.createAppeal({ decisionId: decision.id, appellantId, statement: command.statement.trim() }, clock.now());
    if (appeal === undefined) throw invalidState("You already appealed this decision.");
    await audit.record({ actorId: appellantId, action: "moderation.appeal_submitted", entityType: "moderation_decision", entityId: decision.id, metadata: { appealId: appeal.id } });
    return convertAppealToDto(appeal);
  }
}
