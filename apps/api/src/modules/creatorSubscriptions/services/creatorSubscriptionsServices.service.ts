import type { CreatorPlansService } from "./creatorPlans.service.js";
import type { CreatorSubscriptionBillingService } from "./creatorSubscriptionBilling.service.js";
import type { CreatorSubscriptionLifecycleService } from "./creatorSubscriptionLifecycle.service.js";

export interface CreatorSubscriptionsServices {
  readonly plans: CreatorPlansService;
  readonly billing: CreatorSubscriptionBillingService;
  readonly lifecycle: CreatorSubscriptionLifecycleService;
}
