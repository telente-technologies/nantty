import { notFound } from "../../../errors/domain.error.js";
import type { AccountSuspensionRequest, AccountSuspensions } from "../../../interfaces/accountStanding.interface.js";
import type { ModerationEnforcementService } from "./moderationEnforcement.service.js";
import type { ModerationService } from "./moderation.service.js";

const DAY_IN_MILLISECONDS = 86_400_000;
const MAXIMUM_SUSPENSIONS_TO_LIFT = 20;

export class ModerationAccountSuspensions implements AccountSuspensions {
  public constructor(private readonly moderationService: ModerationService, private readonly enforcement: ModerationEnforcementService) {}

  public async isAccountSuspended(userId: string, now: Date): Promise<boolean> {
    return (await this.moderationService.dependencies.decisions.findActiveSuspension(userId, now)) !== undefined;
  }

  public async suspendAccount(request: AccountSuspensionRequest): Promise<{ readonly decisionId: string }> {
    const { clock } = this.moderationService.dependencies;
    const caseRecord = await this.moderationService.findOrOpenCase({ targetType: "user", targetId: request.userId, source: "report", priority: 0, flaggedReason: null });
    if (caseRecord.targetOwnerId === null) throw notFound("User");
    const suspensionDays = request.endsAt === null ? null : Math.max(1, Math.ceil((request.endsAt.getTime() - clock.now().getTime()) / DAY_IN_MILLISECONDS));
    const decision = await this.enforcement.applyDecision({
      caseRecord,
      action: "suspend",
      reason: request.reason,
      actor: { userId: request.actorId, roles: [], sessionId: "" },
      suspensionDays,
    });
    return { decisionId: decision.id };
  }

  public async liftAccountSuspensions(userId: string, actorId: string, reason: string): Promise<number> {
    const { decisions, audit, clock } = this.moderationService.dependencies;
    let lifted = 0;
    for (let attempt = 0; attempt < MAXIMUM_SUSPENSIONS_TO_LIFT; attempt += 1) {
      const active = await decisions.findActiveSuspension(userId, clock.now());
      if (active === undefined) break;
      await decisions.liftSuspensionForDecision(active.decisionId, clock.now());
      await decisions.markDecisionReversed(active.decisionId, clock.now());
      lifted += 1;
    }
    if (lifted > 0) await audit.record({ actorId, action: "moderation.suspension_lifted", entityType: "user", entityId: userId, metadata: { reason, lifted } });
    return lifted;
  }
}
