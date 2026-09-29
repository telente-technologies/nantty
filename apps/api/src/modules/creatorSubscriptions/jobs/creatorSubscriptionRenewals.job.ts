import type { ScheduledJob } from "../../../jobs/scheduledJobs.job.js";
import type { CreatorSubscriptionLifecycleService } from "../services/creatorSubscriptionLifecycle.service.js";

export function createCreatorSubscriptionRenewalsJob(lifecycle: CreatorSubscriptionLifecycleService): ScheduledJob {
  return {
    id: "creator-subscriptions.renewals",
    every: "1h",
    run: async () => {
      await lifecycle.processDueSubscriptions();
    },
  };
}
