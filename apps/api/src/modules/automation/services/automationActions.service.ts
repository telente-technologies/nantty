import { unprocessable } from "../../../errors/domain.error.js";
import type { ModerationQueue } from "../../../interfaces/moderationQueue.interface.js";
import { MODERATION_TARGET_TYPES, type ModerationTargetType } from "../../../interfaces/moderationTargets.interface.js";
import type { AutomationEventData, AutomationRuleRecord, RuleAction } from "../models/automation.model.js";
import { readEventField } from "./conditionEvaluator.service.js";

const DEFAULT_USER_FIELDS = ["targetOwnerId", "ownerId", "userId", "senderId"] as const;

function readTarget(data: AutomationEventData): { readonly targetType: ModerationTargetType; readonly targetId: string } {
  const targetType = readEventField(data, "targetType").value;
  const targetId = readEventField(data, "targetId").value;
  if (typeof targetType !== "string" || !(MODERATION_TARGET_TYPES as readonly string[]).includes(targetType) || typeof targetId !== "string") {
    throw unprocessable("This event has no moderation target.");
  }
  return { targetType: targetType as ModerationTargetType, targetId };
}

function readUserId(data: AutomationEventData, userField: string | undefined): string {
  const fields = userField === undefined ? DEFAULT_USER_FIELDS : [userField];
  for (const field of fields) {
    const value = readEventField(data, field).value;
    if (typeof value === "string" && value !== "") return value;
  }
  throw unprocessable("This event has no user to flag.");
}

export class AutomationActionRunner {
  public constructor(private readonly moderationQueue: ModerationQueue) {}

  public async runAction(rule: AutomationRuleRecord, action: RuleAction, data: AutomationEventData): Promise<string> {
    const reason = `Automation rule "${rule.name}"`;
    switch (action.type) {
      case "hide_target": {
        const { caseId } = await this.moderationQueue.hideTargetPendingReview({ ...readTarget(data), reason, priority: action.params?.priority ?? 50 });
        return `hidden pending review in case ${caseId}`;
      }
      case "queue_for_review": {
        const { caseId } = await this.moderationQueue.queueTargetForReview({ ...readTarget(data), reason, priority: action.params?.priority ?? 10 });
        return `queued in case ${caseId}`;
      }
      case "flag_user": {
        const userId = readUserId(data, action.params?.userField);
        const { caseId } = await this.moderationQueue.queueTargetForReview({ targetType: "user", targetId: userId, reason, priority: action.params?.priority ?? 20 });
        return `user flagged in case ${caseId}`;
      }
    }
  }
}
