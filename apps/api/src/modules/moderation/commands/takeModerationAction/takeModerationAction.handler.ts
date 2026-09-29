import { CommandHandler } from "@zudojs/cqrs";

import { notFound } from "../../../../errors/domain.error.js";
import { convertDecisionToDto, type DecisionDto } from "../../dtos/moderation.dto.js";
import type { ModerationEnforcementService } from "../../services/moderationEnforcement.service.js";
import type { ModerationService } from "../../services/moderation.service.js";
import type { TakeModerationActionCommand } from "./takeModerationAction.command.js";

export class TakeModerationActionHandler extends CommandHandler<TakeModerationActionCommand, DecisionDto> {
  public readonly commandType = "moderation.takeModerationAction" as const;

  public constructor(private readonly moderationService: ModerationService, private readonly enforcement: ModerationEnforcementService) {
    super();
  }

  public async execute(command: TakeModerationActionCommand): Promise<DecisionDto> {
    const caseRecord = await this.moderationService.dependencies.cases.findById(command.caseId);
    if (caseRecord === undefined) throw notFound("Moderation case");
    const decision = await this.enforcement.applyDecision({
      caseRecord,
      action: command.input.action,
      reason: command.input.reason.trim(),
      actor: command.principal,
      suspensionDays: command.input.suspensionDays ?? null,
    });
    return convertDecisionToDto(decision, undefined);
  }
}
