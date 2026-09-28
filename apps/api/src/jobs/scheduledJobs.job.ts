import type { Scheduler } from "@zudojs/scheduler";

export interface ScheduledJob {
  readonly id: string;
  readonly every: string;
  readonly run: () => Promise<void>;
}

export function registerScheduledJobs(scheduler: Scheduler, jobs: readonly ScheduledJob[]): void {
  for (const job of jobs) {
    scheduler.define({ id: job.id, name: job.id, handler: job.run });
    scheduler.every(job.every, job.id, { overlap: "skip" });
  }
}
