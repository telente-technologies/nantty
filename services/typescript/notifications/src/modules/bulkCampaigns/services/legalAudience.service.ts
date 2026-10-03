import type { IdentityDirectory } from "../../../interfaces/identityDirectory.interface.js";
import type { SuppressionRepository } from "../../../interfaces/repositories.interface.js";
import { planBatches } from "./batchPlan.service.js";

export const everyoneSegmentId = "all";

export interface LegalAudienceEstimate {
  readonly totalUsers: number;
  readonly excludedHardBounces: number;
  readonly excludedSuppressed: number;
  readonly recipientCount: number;
  readonly batchesTotal: number;
  readonly estimatedMinutes: number;
}

export class LegalAudienceService {
  public constructor(
    private readonly identity: IdentityDirectory,
    private readonly suppressions: SuppressionRepository,
    private readonly batchSize: number,
    private readonly ratePerSecond: number,
  ) {}

  public async estimate(): Promise<LegalAudienceEstimate> {
    const [{ total }, counts] = await Promise.all([this.identity.countAudience(everyoneSegmentId), this.suppressions.countByReason()]);
    const excludedHardBounces = Math.min(total, counts.hard_bounce);
    const excludedSuppressed = Math.min(total - excludedHardBounces, counts.manual);
    const recipientCount = total - excludedHardBounces - excludedSuppressed;
    const plan = planBatches(total, this.batchSize, this.ratePerSecond);
    return { totalUsers: total, excludedHardBounces, excludedSuppressed, recipientCount, batchesTotal: plan.batchesTotal, estimatedMinutes: Math.ceil(plan.estimatedSeconds / 60) };
  }
}
