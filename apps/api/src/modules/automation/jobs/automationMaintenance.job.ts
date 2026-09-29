import type { ScheduledJob } from "../../../jobs/scheduledJobs.job.js";
import type { AutomationEngine } from "../services/automationEngine.service.js";

const OCCURRENCE_RETENTION_MILLISECONDS = 8 * 86_400_000;

export function createAutomationOccurrenceCleanupJob(engine: AutomationEngine): ScheduledJob {
  return {
    id: "automation.deleteOldEventOccurrences",
    every: "1h",
    run: async () => {
      const { executions, clock } = engine.dependencies;
      await executions.deleteEventOccurrencesBefore(new Date(clock.now().getTime() - OCCURRENCE_RETENTION_MILLISECONDS));
    },
  };
}
