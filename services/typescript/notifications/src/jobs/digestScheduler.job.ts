import { digestJobType } from "../constants/delivery.constant.js";
import type { DigestKind } from "../interfaces/digestSource.interface.js";
import type { JobQueue } from "../interfaces/jobQueue.interface.js";

const sendHourUtc = 9;

export function computeDuePeriods(now: Date): { readonly kind: DigestKind; readonly periodKey: string }[] {
  if (now.getUTCHours() < sendHourUtc) return [];
  const day = now.toISOString().slice(0, 10);
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - ((now.getUTCDay() + 6) % 7))).toISOString().slice(0, 10);
  return [
    { kind: "followRequests", periodKey: day },
    { kind: "messageRequests", periodKey: day },
    ...(now.getUTCDay() === 1 ? [{ kind: "weekly" as const, periodKey: monday }] : []),
  ];
}

export class DigestSchedulerJob {
  private timer: NodeJS.Timeout | undefined;
  private readonly enqueued = new Set<string>();

  public constructor(private readonly jobQueue: JobQueue, private readonly jobsQueueUrl: string, private readonly now: () => Date = () => new Date()) {}

  public async tick(): Promise<number> {
    let count = 0;
    for (const due of computeDuePeriods(this.now())) {
      const key = `${due.kind}:${due.periodKey}`;
      if (this.enqueued.has(key)) continue;
      this.enqueued.add(key);
      await this.jobQueue.send(this.jobsQueueUrl, { type: digestJobType, kind: due.kind, periodKey: due.periodKey, cursor: null });
      count += 1;
    }
    return count;
  }

  public start(): void {
    this.timer = setInterval(() => void this.tick().catch(() => undefined), 10 * 60_000);
    this.timer.unref();
  }

  public stop(): void {
    if (this.timer !== undefined) clearInterval(this.timer);
  }
}
