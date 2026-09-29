import type { AutomatedModerationRequest, ModerationQueue } from "../../../interfaces/moderationQueue.interface.js";
import type { ModerationEnforcementService } from "./moderationEnforcement.service.js";
import type { ModerationService } from "./moderation.service.js";

export class AutomatedModerationQueue implements ModerationQueue {
  public constructor(private readonly moderationService: ModerationService, private readonly enforcement: ModerationEnforcementService) {}

  public async queueTargetForReview(request: AutomatedModerationRequest): Promise<{ readonly caseId: string }> {
    const caseRecord = await this.moderationService.findOrOpenCase({ ...request, source: "automation", flaggedReason: request.reason });
    return { caseId: caseRecord.id };
  }

  public async hideTargetPendingReview(request: AutomatedModerationRequest): Promise<{ readonly caseId: string }> {
    const caseRecord = await this.moderationService.findOrOpenCase({ ...request, source: "automation", flaggedReason: request.reason });
    if (caseRecord.autoHidden) return { caseId: caseRecord.id };
    await this.enforcement.applyDecision({ caseRecord, action: "hide", reason: request.reason, actor: null, suspensionDays: null, keepCaseOpen: true });
    await this.moderationService.dependencies.cases.updateCase(caseRecord.id, { autoHidden: true }, this.moderationService.dependencies.clock.now());
    return { caseId: caseRecord.id };
  }
}
