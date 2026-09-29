import type { ScheduledJob } from "../../../jobs/scheduledJobs.job.js";
import type { IntelligenceEventForwarder } from "../services/intelligenceEventForwarder.service.js";

export function createIntelligenceEventFlushJob(forwarder: IntelligenceEventForwarder, flushIntervalSeconds: number): ScheduledJob {
  return {
    id: "intelligence-events-flush",
    every: `${flushIntervalSeconds}s`,
    run: () => forwarder.flushPendingEvents(),
  };
}
