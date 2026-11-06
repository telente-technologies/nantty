import { randomUUID } from "node:crypto";

import type { Logger } from "@nantty/fastify-platform";
import type { JobQueue } from "../interfaces/jobQueue.interface.js";
import type { ReengagementRepository } from "../interfaces/reengagementRepository.interface.js";
import { isInLocalQuietHours, reengagementCampaignId, reengagementContentKeyAt, reengagementInactiveDays, reengagementCapDays, reengagementJobType, reengagementQueueLeaseMs } from "../modules/reengagement/services/reengagementPolicy.service.js";

const dayMs = 24 * 60 * 60_000;
const intervalMs = 10 * 60_000;
const sweepBatchSize = 100;

export class ReengagementSchedulerJob {
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  public constructor(
    private readonly repository: ReengagementRepository,
    private readonly jobQueue: JobQueue,
    private readonly jobsQueueUrl: string,
    private readonly logger: Logger,
    private readonly quietHours: { readonly quietHoursStart: string; readonly quietHoursEnd: string },
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async tick(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    try {
      const now = this.now();
      const inactiveBefore = new Date(now.getTime() - reengagementInactiveDays * dayMs);
      await this.repository.createDueDeliveries({
        now,
        inactiveBefore,
        cooldownBefore: new Date(now.getTime() - reengagementCapDays * dayMs),
        campaignId: reengagementCampaignId,
        contentKey: reengagementContentKeyAt(now),
        limit: sweepBatchSize,
      });
      const pending = await this.repository.listPending({ now, inactiveBefore, limit: sweepBatchSize * 10 });
      let queued = 0;
      for (const item of pending) {
        if (queued >= sweepBatchSize || isInLocalQuietHours(item.activity.timeZone, now, { start: this.quietHours.quietHoursStart, end: this.quietHours.quietHoursEnd })) continue;
        const token = randomUUID();
        if (!(await this.repository.leaseForQueue(item.id, now, new Date(now.getTime() + reengagementQueueLeaseMs), token))) continue;
        try {
          await this.jobQueue.send(this.jobsQueueUrl, { type: reengagementJobType, deliveryId: item.id });
          queued += 1;
        } catch (error) {
          await this.repository.releaseQueueLease(item.id, token);
          this.logger.warn("re-engagement job enqueue failed", { deliveryId: item.id, error: error instanceof Error ? error.message : String(error) });
        }
      }
      return queued;
    } finally {
      this.running = false;
    }
  }

  public start(): void {
    this.timer = setInterval(() => void this.tick().catch((error: unknown) => this.logger.warn("re-engagement sweep failed", { error: error instanceof Error ? error.message : String(error) })), intervalMs);
    this.timer.unref();
  }

  public stop(): void {
    if (this.timer !== undefined) clearInterval(this.timer);
  }
}
