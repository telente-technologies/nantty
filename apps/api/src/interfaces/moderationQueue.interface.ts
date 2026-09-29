import type { ModerationTargetType } from "./moderationTargets.interface.js";

export interface AutomatedModerationRequest {
  readonly targetType: ModerationTargetType;
  readonly targetId: string;
  readonly reason: string;
  readonly priority: number;
}

export interface ModerationQueue {
  queueTargetForReview(request: AutomatedModerationRequest): Promise<{ readonly caseId: string }>;
  hideTargetPendingReview(request: AutomatedModerationRequest): Promise<{ readonly caseId: string }>;
}
