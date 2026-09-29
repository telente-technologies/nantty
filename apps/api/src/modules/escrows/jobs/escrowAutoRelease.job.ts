import type { ScheduledJob } from "../../../jobs/scheduledJobs.job.js";
import type { EscrowsService } from "../services/escrows.service.js";

export function createEscrowAutoReleaseJob(escrowsService: EscrowsService): ScheduledJob {
  return {
    id: "escrow-auto-release",
    every: "15m",
    run: async () => {
      await escrowsService.releaseEscrowsPastInspectionPeriod();
    },
  };
}
