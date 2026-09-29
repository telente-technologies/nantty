import type { ScheduledJob } from "../../../jobs/scheduledJobs.job.js";
import type { MediaMaintenanceService } from "../services/mediaMaintenance.service.js";

export function createAbandonedUploadsCleanupJob(maintenance: MediaMaintenanceService): ScheduledJob {
  return {
    id: "media-abandoned-uploads-cleanup",
    every: "1h",
    run: async () => {
      await maintenance.deleteAbandonedUploads();
    },
  };
}

export function createStalledMediaProcessingJob(maintenance: MediaMaintenanceService): ScheduledJob {
  return {
    id: "media-stalled-processing-recovery",
    every: "30m",
    run: async () => {
      await maintenance.requeueStalledProcessing();
    },
  };
}
