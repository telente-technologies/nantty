import type { CommandBus } from "@zudojs/cqrs";
import type { EventBus } from "@zudojs/events";

import type { AuditRecorder } from "../../../interfaces/audit.interface.js";
import type { Clock } from "../../../interfaces/clock.interface.js";
import type { ModerationTargetType } from "../../../interfaces/moderationTargets.interface.js";
import type { RealtimePublisher } from "../../../interfaces/realtimePublisher.interface.js";
import type { UserDirectory } from "../../../interfaces/userDirectory.interface.js";
import type { CaseRecord, CaseSource } from "../models/moderation.model.js";
import type { ModerationDecisionsRepository } from "../repositories/decisions.repository.js";
import type { ModerationCasesRepository, ModerationReportsRepository } from "../repositories/reportsAndCases.repository.js";
import type { ModerationTargetRegistry } from "./moderationTargetRegistry.service.js";

export interface ModerationDependencies {
  readonly reports: ModerationReportsRepository;
  readonly cases: ModerationCasesRepository;
  readonly decisions: ModerationDecisionsRepository;
  readonly targets: ModerationTargetRegistry;
  readonly userDirectory: UserDirectory;
  readonly audit: AuditRecorder;
  readonly events: EventBus;
  readonly commands: CommandBus;
  readonly realtime: RealtimePublisher;
  readonly clock: Clock;
}

export interface CaseOpening {
  readonly targetType: ModerationTargetType;
  readonly targetId: string;
  readonly source: CaseSource;
  readonly priority: number;
  readonly flaggedReason: string | null;
}

export class ModerationService {
  public constructor(public readonly dependencies: ModerationDependencies) {}

  public async findOrOpenCase(opening: CaseOpening): Promise<CaseRecord> {
    const { cases, targets, clock } = this.dependencies;
    const existing = await cases.findOpenCase(opening.targetType, opening.targetId);
    if (existing !== undefined) {
      if (opening.priority <= existing.priority && opening.flaggedReason === null) return existing;
      const raised = await cases.updateCase(
        existing.id,
        { priority: Math.max(existing.priority, opening.priority), ...(opening.flaggedReason === null ? {} : { flaggedReason: opening.flaggedReason }) },
        clock.now(),
      );
      return raised ?? existing;
    }
    const description = await targets.describeTargetOrThrow(opening.targetType, opening.targetId);
    return cases.openCase(
      {
        targetType: opening.targetType,
        targetId: opening.targetId,
        targetOwnerId: description.ownerUserId,
        targetSummary: description.summary,
        priority: opening.priority,
        source: opening.source,
        flaggedReason: opening.flaggedReason,
      },
      clock.now(),
    );
  }
}
