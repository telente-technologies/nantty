import type { ScheduledJob } from "../../../jobs/scheduledJobs.job.js";
import type { SubscriptionRenewalsService } from "../services/subscriptionRenewals.service.js";

export function createSubscriptionRenewalsJob(renewals: SubscriptionRenewalsService): ScheduledJob {
  return {
    id: "subscription-renewals",
    every: "1h",
    run: async () => {
      await renewals.processDueSubscriptions();
    },
  };
}
