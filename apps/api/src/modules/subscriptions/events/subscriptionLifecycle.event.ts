import { defineEvent } from "@zudojs/events";

export interface SubscriptionLifecyclePayload {
  readonly profileId: string;
  readonly profileType: string;
  readonly plan: string;
  readonly status: string;
}

export const SubscriptionStartedEvent = defineEvent<"subscriptions.started", SubscriptionLifecyclePayload>("subscriptions.started");
export const SubscriptionRenewedEvent = defineEvent<"subscriptions.renewed", SubscriptionLifecyclePayload>("subscriptions.renewed");
export const SubscriptionCancelledEvent = defineEvent<"subscriptions.cancelled", SubscriptionLifecyclePayload>("subscriptions.cancelled");
export const SubscriptionExpiredEvent = defineEvent<"subscriptions.expired", SubscriptionLifecyclePayload>("subscriptions.expired");
export const SubscriptionUpgradedEvent = defineEvent<"subscriptions.upgraded", SubscriptionLifecyclePayload>("subscriptions.upgraded");
export const SubscriptionDowngradedEvent = defineEvent<"subscriptions.downgraded", SubscriptionLifecyclePayload>("subscriptions.downgraded");
export const SubscriptionSuspendedEvent = defineEvent<"subscriptions.suspended", SubscriptionLifecyclePayload>("subscriptions.suspended");
export const SubscriptionResumedEvent = defineEvent<"subscriptions.resumed", SubscriptionLifecyclePayload>("subscriptions.resumed");
export const SubscriptionPastDueEvent = defineEvent<"subscriptions.pastDue", SubscriptionLifecyclePayload>("subscriptions.pastDue");

export const BADGE_SYNC_EVENTS = [SubscriptionStartedEvent, SubscriptionRenewedEvent, SubscriptionUpgradedEvent, SubscriptionDowngradedEvent, SubscriptionResumedEvent] as const;
export const BADGE_HIDE_EVENTS = [SubscriptionCancelledEvent, SubscriptionExpiredEvent, SubscriptionSuspendedEvent, SubscriptionPastDueEvent] as const;
