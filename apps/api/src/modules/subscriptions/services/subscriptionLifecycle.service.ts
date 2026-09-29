import type { EventBus, EventDefinition } from "@zudojs/events";

import { invalidState, notFound, unprocessable } from "../../../errors/domain.error.js";
import type { AuditRecorder } from "../../../interfaces/audit.interface.js";
import type { Clock } from "../../../interfaces/clock.interface.js";
import type { VerificationTier } from "../../../interfaces/verificationBadge.interface.js";
import { publishEvent } from "../../../loaders/events.loader.js";
import type { ResolvedProfile } from "../../verifications/models/verifications.model.js";
import {
  SubscriptionCancelledEvent,
  SubscriptionDowngradedEvent,
  SubscriptionExpiredEvent,
  SubscriptionPastDueEvent,
  SubscriptionRenewedEvent,
  SubscriptionResumedEvent,
  SubscriptionStartedEvent,
  SubscriptionSuspendedEvent,
  SubscriptionUpgradedEvent,
  type SubscriptionLifecyclePayload,
} from "../events/subscriptionLifecycle.event.js";
import type { BillingInterval, SubscriptionPatch, SubscriptionRecord, SubscriptionStatus } from "../models/subscriptions.model.js";
import { addBillingInterval, addDays, canSubscriptionTransition, isPlanDowngrade, isPlanUpgrade, isPlanValidForProfileType } from "../policies/subscription.policy.js";
import type { SubscriptionsRepository } from "../repositories/subscriptions.repository.js";

export interface PaidPeriod {
  readonly plan: VerificationTier;
  readonly interval: BillingInterval;
  readonly provider: string;
  readonly currency: SubscriptionRecord["currency"];
  readonly amount: number;
  readonly authorizationEncrypted: string | null;
  readonly payerEmail: string | null;
}

export type AdminSubscriptionAction = "upgrade" | "downgrade" | "expire" | "suspend" | "resume" | "past-due";

type Lifecycle = EventDefinition<string, SubscriptionLifecyclePayload>;

export class SubscriptionLifecycleService {
  public constructor(
    public readonly subscriptions: SubscriptionsRepository,
    private readonly audit: AuditRecorder,
    private readonly events: EventBus,
    public readonly clock: Clock,
  ) {}

  public async startTrial(profile: ResolvedProfile, plan: VerificationTier, interval: BillingInterval, trialDays: number, actorId: string): Promise<SubscriptionRecord> {
    const now = this.clock.now();
    const trialEndsAt = addDays(now, trialDays);
    const existing = await this.subscriptions.findByProfileId(profile.profileId);
    if (existing !== undefined && !canSubscriptionTransition(existing.status, "TRIALING")) throw invalidState("profile already has an active subscription");
    const fields = { plan, interval, status: "TRIALING" as const, autoRenew: true, endsAt: trialEndsAt, trialEndsAt, trialUsed: true, pastDueSince: null, cancelledAt: null };
    const record = existing === undefined
      ? await this.subscriptions.create({ ...profile, ...fields, provider: null, currency: null, amount: null, authorizationEncrypted: null, payerEmail: null, startsAt: now, lastChargeAttemptAt: null })
      : await this.subscriptions.update(profile.profileId, { ...fields, startsAt: now }, now);
    return this.announce(actorId, "subscriptions.trial_started", record, existing?.status ?? null, SubscriptionStartedEvent);
  }

  public async activatePaidPeriod(profile: ResolvedProfile, period: PaidPeriod, actorId: string | null): Promise<SubscriptionRecord> {
    const now = this.clock.now();
    const existing = await this.subscriptions.findByProfileId(profile.profileId);
    const billing = { ...period, status: "ACTIVE" as const, autoRenew: true, pastDueSince: null, cancelledAt: null, lastChargeAttemptAt: now };
    if (existing === undefined) {
      const created = await this.subscriptions.create({ ...profile, ...billing, startsAt: now, endsAt: addBillingInterval(now, period.interval), trialEndsAt: null, trialUsed: false });
      return this.announce(actorId, "subscriptions.started", created, null, SubscriptionStartedEvent);
    }
    const renewing = existing.status === "ACTIVE" || existing.status === "PAST_DUE";
    if (!renewing && !canSubscriptionTransition(existing.status, "ACTIVE")) throw invalidState("subscription state transition is not allowed");
    const periodStart = existing.status === "ACTIVE" && existing.endsAt !== null && existing.endsAt > now ? existing.endsAt : now;
    const updated = await this.subscriptions.update(profile.profileId, { ...billing, endsAt: addBillingInterval(periodStart, period.interval), ...(renewing ? {} : { startsAt: now }) }, now);
    return this.announce(actorId, renewing ? "subscriptions.renewed" : "subscriptions.started", updated, existing.status, renewing ? SubscriptionRenewedEvent : SubscriptionStartedEvent);
  }

  public async renewPeriod(profileId: string): Promise<SubscriptionRecord> {
    const existing = await this.findOrThrow(profileId);
    const now = this.clock.now();
    const periodStart = existing.endsAt !== null && existing.endsAt > now ? existing.endsAt : now;
    const updated = await this.subscriptions.update(profileId, { status: "ACTIVE", endsAt: addBillingInterval(periodStart, existing.interval), pastDueSince: null }, now);
    return this.announce(null, "subscriptions.renewed", updated, existing.status, SubscriptionRenewedEvent);
  }

  public async cancel(profileId: string, actorId: string): Promise<SubscriptionRecord> {
    const existing = await this.findOrThrow(profileId);
    if (existing.status !== "ACTIVE" && existing.status !== "TRIALING") throw invalidState("subscription state transition is not allowed");
    return this.transition(existing, "CANCELLED", { autoRenew: false, cancelledAt: this.clock.now() }, actorId, "subscriptions.cancelled", SubscriptionCancelledEvent);
  }

  public async resumeCancelled(profileId: string, actorId: string): Promise<SubscriptionRecord> {
    const existing = await this.findOrThrow(profileId);
    const now = this.clock.now();
    if (existing.status !== "CANCELLED" || existing.endsAt === null || existing.endsAt <= now) throw invalidState("Only a cancelled subscription that has not ended can be resumed.");
    const status: SubscriptionStatus = existing.trialEndsAt !== null && existing.trialEndsAt > now ? "TRIALING" : "ACTIVE";
    return this.transition(existing, status, { autoRenew: true, cancelledAt: null }, actorId, "subscriptions.resumed", SubscriptionResumedEvent);
  }

  public async resumeSuspended(profileId: string, actorId: string): Promise<SubscriptionRecord> {
    const existing = await this.findOrThrow(profileId);
    if (existing.status !== "SUSPENDED") throw invalidState("subscription state transition is not allowed");
    return this.transition(existing, "ACTIVE", {}, actorId, "subscriptions.resumed", SubscriptionResumedEvent);
  }

  public async changePlan(profileId: string, plan: VerificationTier, direction: "upgrade" | "downgrade", actorId: string): Promise<SubscriptionRecord> {
    const existing = await this.findOrThrow(profileId);
    if (!isPlanValidForProfileType(existing.profileType, plan)) throw unprocessable("plan is not valid for this profile type");
    const allowed = direction === "upgrade" ? isPlanUpgrade(existing.plan, plan) : isPlanDowngrade(existing.plan, plan);
    if (!allowed) throw invalidState("subscription state transition is not allowed");
    const updated = await this.subscriptions.update(profileId, { plan }, this.clock.now());
    return this.announce(actorId, `subscriptions.${direction}d`, updated, existing.status, direction === "upgrade" ? SubscriptionUpgradedEvent : SubscriptionDowngradedEvent);
  }

  public async expire(profileId: string, actorId: string | null): Promise<SubscriptionRecord> {
    const existing = await this.findOrThrow(profileId);
    if (!canSubscriptionTransition(existing.status, "EXPIRED")) throw invalidState("subscription state transition is not allowed");
    return this.transition(existing, "EXPIRED", { autoRenew: false, cancelledAt: this.clock.now() }, actorId, "subscriptions.expired", SubscriptionExpiredEvent);
  }

  public async suspend(profileId: string, actorId: string): Promise<SubscriptionRecord> {
    const existing = await this.findOrThrow(profileId);
    if (!canSubscriptionTransition(existing.status, "SUSPENDED")) throw invalidState("subscription state transition is not allowed");
    return this.transition(existing, "SUSPENDED", {}, actorId, "subscriptions.suspended", SubscriptionSuspendedEvent);
  }

  public async markPastDue(profileId: string, actorId: string | null): Promise<SubscriptionRecord> {
    const existing = await this.findOrThrow(profileId);
    if (!canSubscriptionTransition(existing.status, "PAST_DUE")) throw invalidState("subscription state transition is not allowed");
    return this.transition(existing, "PAST_DUE", { pastDueSince: this.clock.now() }, actorId, "subscriptions.past_due", SubscriptionPastDueEvent);
  }

  public applyAdminAction(adminId: string, profileId: string, action: AdminSubscriptionAction, plan: VerificationTier | undefined): Promise<SubscriptionRecord> {
    if (action === "upgrade" || action === "downgrade") {
      if (plan === undefined) throw unprocessable("Choose the plan to move to.");
      return this.changePlan(profileId, plan, action, adminId);
    }
    if (action === "expire") return this.expire(profileId, adminId);
    if (action === "suspend") return this.suspend(profileId, adminId);
    if (action === "resume") return this.resumeSuspended(profileId, adminId);
    return this.markPastDue(profileId, adminId);
  }

  public async findOrThrow(profileId: string): Promise<SubscriptionRecord> {
    const existing = await this.subscriptions.findByProfileId(profileId);
    if (existing === undefined) throw notFound("Subscription");
    return existing;
  }

  private async transition(existing: SubscriptionRecord, status: SubscriptionStatus, patch: SubscriptionPatch, actorId: string | null, action: string, event: Lifecycle): Promise<SubscriptionRecord> {
    const updated = await this.subscriptions.update(existing.profileId, { ...patch, status }, this.clock.now());
    return this.announce(actorId, action, updated, existing.status, event);
  }

  private async announce(actorId: string | null, action: string, record: SubscriptionRecord, previousStatus: SubscriptionStatus | null, event: Lifecycle): Promise<SubscriptionRecord> {
    await this.audit.record({
      actorId,
      action,
      entityType: "profile_subscription",
      entityId: record.profileId,
      metadata: { profileType: record.profileType, plan: record.plan, previousStatus, newStatus: record.status, endsAt: record.endsAt?.toISOString() ?? null },
    });
    await publishEvent(this.events, event, { profileId: record.profileId, profileType: record.profileType, plan: record.plan, status: record.status });
    return record;
  }
}
