import { unprocessable } from "../../../errors/domain.error.js";
import { NotificationRequestedEvent } from "../../../events/notificationRequested.event.js";
import type { Principal } from "../../../interfaces/principal.interface.js";
import { publishEvent } from "../../../loaders/events.loader.js";
import { ReviewVerificationCommand } from "../../verifications/commands/reviewVerification/reviewVerification.command.js";
import { ModerationDecisionTakenEvent } from "../events/moderationEvents.event.js";
import type { CaseRecord, DecisionRecord, ModerationAction } from "../models/moderation.model.js";
import type { ModerationService } from "./moderation.service.js";

const DAY_IN_MILLISECONDS = 86_400_000;

export interface ModerationActionRequest {
  readonly caseRecord: CaseRecord;
  readonly action: ModerationAction;
  readonly reason: string;
  readonly actor: Principal | null;
  readonly suspensionDays: number | null;
  readonly keepCaseOpen?: boolean;
}

export interface DecisionReversal {
  readonly restored: boolean;
  readonly note: string;
}

const AFFECTED_USER_MESSAGES: Partial<Record<ModerationAction, string>> = {
  hide: "Some of your content was hidden because it may break our community guidelines.",
  remove: "Some of your content was removed because it broke our community guidelines.",
  warn: "You received a warning for breaking our community guidelines.",
  suspend: "Your account was suspended for breaking our community guidelines.",
  revoke_verification: "Your verification badge was revoked.",
};

export class ModerationEnforcementService {
  public constructor(private readonly moderationService: ModerationService) {}

  public async applyDecision(request: ModerationActionRequest): Promise<DecisionRecord> {
    const { decisions, cases, reports, targets, audit, events, commands, realtime, clock } = this.moderationService.dependencies;
    const { caseRecord, action, reason, actor } = request;
    const now = clock.now();
    const affectedUserId = caseRecord.targetOwnerId;
    if ((action === "hide" || action === "remove") && caseRecord.targetType === "user") throw unprocessable("Accounts cannot be hidden: suspend the account instead.");
    if ((action === "suspend" || action === "warn" || action === "revoke_verification") && affectedUserId === null) throw unprocessable("This content has no owner to act on.");
    if (action === "dismiss" && caseRecord.status !== "open") throw unprocessable("Only open cases can be dismissed.");
    if (action === "revoke_verification") {
      if (actor === null || affectedUserId === null) throw unprocessable("Only an admin can revoke a verification.");
      await commands.execute(new ReviewVerificationCommand(actor, affectedUserId, "revoke", reason));
    }
    if (action === "hide" || action === "remove") await targets.requireGateway(caseRecord.targetType).applyContentAction(caseRecord.targetId, action, now);
    const suspensionEndsAt = action === "suspend" && request.suspensionDays !== null ? new Date(now.getTime() + request.suspensionDays * DAY_IN_MILLISECONDS) : null;
    const decision = await decisions.createDecision(
      { caseId: caseRecord.id, targetType: caseRecord.targetType, targetId: caseRecord.targetId, affectedUserId, action, reason, actorId: actor?.userId ?? null, suspensionEndsAt },
      now,
    );
    if (action === "suspend" && affectedUserId !== null) {
      await decisions.createSuspension({ userId: affectedUserId, decisionId: decision.id, endsAt: suspensionEndsAt }, now);
      realtime.disconnectUser(affectedUserId, "Account suspended");
    }
    if (request.keepCaseOpen === true) {
      await reports.updateReportsForCase(caseRecord.id, "reviewing", null, now);
    } else {
      await cases.updateCase(caseRecord.id, { status: action === "dismiss" ? "dismissed" : "actioned", resolvedById: actor?.userId ?? null, resolvedAt: now }, now);
      const outcome = action === "dismiss" ? "This didn't break our guidelines, but you can block the account." : "We took action. Thanks for keeping Zudomart safe.";
      await reports.updateReportsForCase(caseRecord.id, action === "dismiss" ? "no_violation" : "action_taken", outcome, now);
    }
    await this.notifyAffectedUser(decision);
    await audit.record({
      actorId: actor?.userId ?? null,
      action: `moderation.${action}`,
      entityType: caseRecord.targetType,
      entityId: caseRecord.targetId,
      metadata: { caseId: caseRecord.id, decisionId: decision.id, reason, suspensionEndsAt: suspensionEndsAt?.toISOString() ?? null, automated: actor === null },
    });
    await publishEvent(events, ModerationDecisionTakenEvent, {
      decisionId: decision.id,
      caseId: caseRecord.id,
      action,
      targetType: caseRecord.targetType,
      targetId: caseRecord.targetId,
      affectedUserId,
      automated: actor === null,
    });
    return decision;
  }

  public async reverseDecision(decision: DecisionRecord): Promise<DecisionReversal> {
    const { decisions, targets, clock } = this.moderationService.dependencies;
    const now = clock.now();
    let reversal: DecisionReversal = { restored: true, note: "No change was needed." };
    if (decision.action === "hide" || decision.action === "remove") {
      const restored = await targets.requireGateway(decision.targetType).applyContentAction(decision.targetId, "restore", now);
      reversal = restored ? { restored, note: "The content was restored." } : { restored, note: "This content type cannot be restored automatically." };
    }
    if (decision.action === "suspend") {
      await decisions.liftSuspensionForDecision(decision.id, now);
      reversal = { restored: true, note: "The suspension was lifted." };
    }
    if (decision.action === "revoke_verification") reversal = { restored: false, note: "Re-approve the verification from the verification queue." };
    await decisions.markDecisionReversed(decision.id, now);
    return reversal;
  }

  private async notifyAffectedUser(decision: DecisionRecord): Promise<void> {
    const body = AFFECTED_USER_MESSAGES[decision.action];
    if (body === undefined || decision.affectedUserId === null) return;
    await publishEvent(this.moderationService.dependencies.events, NotificationRequestedEvent, {
      userId: decision.affectedUserId,
      category: "social",
      title: "Community guidelines",
      body: `${body} You can appeal this decision.`,
      data: { decisionId: decision.id, kind: "moderation" },
    });
  }
}
