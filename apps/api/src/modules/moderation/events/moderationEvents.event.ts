import { defineEvent } from "@zudojs/events";

import type { ModerationTargetType } from "../../../interfaces/moderationTargets.interface.js";
import type { ModerationAction } from "../models/moderation.model.js";

export interface ModerationReportSubmittedPayload {
  readonly reportId: string;
  readonly caseId: string;
  readonly reporterId: string;
  readonly targetType: ModerationTargetType;
  readonly targetId: string;
  readonly targetOwnerId: string;
  readonly reason: string;
}

export interface ModerationDecisionTakenPayload {
  readonly decisionId: string;
  readonly caseId: string;
  readonly action: ModerationAction;
  readonly targetType: ModerationTargetType;
  readonly targetId: string;
  readonly affectedUserId: string | null;
  readonly automated: boolean;
}

export const ModerationReportSubmittedEvent = defineEvent<"moderation.reportSubmitted", ModerationReportSubmittedPayload>("moderation.reportSubmitted");
export const ModerationDecisionTakenEvent = defineEvent<"moderation.decisionTaken", ModerationDecisionTakenPayload>("moderation.decisionTaken");
