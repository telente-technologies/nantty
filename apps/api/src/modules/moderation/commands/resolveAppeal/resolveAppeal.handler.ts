import { CommandHandler } from "@zudojs/cqrs";

import { invalidState, notFound } from "../../../../errors/domain.error.js";
import { NotificationRequestedEvent } from "../../../../events/notificationRequested.event.js";
import { publishEvent } from "../../../../loaders/events.loader.js";
import { convertAppealToDto, type AppealDto } from "../../dtos/moderation.dto.js";
import type { DecisionReversal, ModerationEnforcementService } from "../../services/moderationEnforcement.service.js";
import type { ModerationService } from "../../services/moderation.service.js";
import type { ResolveAppealCommand } from "./resolveAppeal.command.js";

export interface ResolvedAppeal {
  readonly appeal: AppealDto;
  readonly reversal: DecisionReversal | null;
}

export class ResolveAppealHandler extends CommandHandler<ResolveAppealCommand, ResolvedAppeal> {
  public readonly commandType = "moderation.resolveAppeal" as const;

  public constructor(private readonly moderationService: ModerationService, private readonly enforcement: ModerationEnforcementService) {
    super();
  }

  public async execute(command: ResolveAppealCommand): Promise<ResolvedAppeal> {
    const { decisions, audit, events, clock } = this.moderationService.dependencies;
    const appeal = await decisions.findAppeal(command.appealId);
    if (appeal === undefined) throw notFound("Appeal");
    if (appeal.status !== "pending") throw invalidState("This appeal was already decided.");
    const decision = await decisions.findDecision(appeal.decisionId);
    if (decision === undefined) throw notFound("Moderation decision");
    const { outcome, note } = command.input;
    const resolution = { status: outcome, reviewerId: command.principal.userId, reviewNote: note.trim(), resolvedAt: clock.now() };
    if (!(await decisions.resolveAppeal(appeal.id, resolution))) throw invalidState("This appeal was already decided.");
    const reversal = outcome === "overturned" ? await this.enforcement.reverseDecision(decision) : null;
    await audit.record({
      actorId: command.principal.userId,
      action: `moderation.appeal_${outcome}`,
      entityType: "moderation_decision",
      entityId: decision.id,
      metadata: { appealId: appeal.id, note: resolution.reviewNote, reversal: reversal?.note ?? null },
    });
    await publishEvent(events, NotificationRequestedEvent, {
      userId: appeal.appellantId,
      category: "social",
      title: "Your appeal was reviewed",
      body: outcome === "overturned" ? "We reversed our decision. Thanks for your patience." : "We reviewed your appeal and kept our decision.",
      data: { decisionId: decision.id, appealId: appeal.id, kind: "moderation" },
    });
    return { appeal: convertAppealToDto({ ...appeal, ...resolution }), reversal };
  }
}
