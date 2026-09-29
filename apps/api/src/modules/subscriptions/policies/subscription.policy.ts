import type { ProfileType, VerificationTier } from "../../../interfaces/verificationBadge.interface.js";
import type { BillingInterval, SubscriptionStatus } from "../models/subscriptions.model.js";

const DAY_MILLISECONDS = 86_400_000;

export function listPlansForProfileType(profileType: ProfileType): readonly VerificationTier[] {
  if (profileType === "PERSONAL") return ["ESSENTIAL", "VERIFIED", "PREMIUM"];
  if (profileType === "GOVERNMENT") return [];
  return ["PRO", "PREMIUM"];
}

export function isPlanValidForProfileType(profileType: ProfileType, plan: VerificationTier): boolean {
  return listPlansForProfileType(profileType).includes(plan);
}

export function canSubscriptionTransition(from: SubscriptionStatus, to: SubscriptionStatus): boolean {
  if (to === "TRIALING") return from === "EXPIRED" || from === "CANCELLED";
  if (to === "ACTIVE") return from === "TRIALING" || from === "PAST_DUE" || from === "SUSPENDED" || from === "EXPIRED" || from === "CANCELLED";
  if (to === "PAST_DUE") return from === "ACTIVE" || from === "TRIALING";
  if (to === "SUSPENDED") return from === "ACTIVE" || from === "TRIALING" || from === "PAST_DUE";
  if (to === "CANCELLED") return from === "ACTIVE" || from === "TRIALING" || from === "PAST_DUE" || from === "SUSPENDED";
  return from === "CANCELLED" || from === "PAST_DUE" || from === "ACTIVE";
}

const PLAN_RANK: Readonly<Partial<Record<VerificationTier, number>>> = { ESSENTIAL: 0, VERIFIED: 1, PRO: 1, PREMIUM: 2 };

export function isPlanUpgrade(from: VerificationTier, to: VerificationTier): boolean {
  const fromRank = PLAN_RANK[from];
  const toRank = PLAN_RANK[to];
  return fromRank !== undefined && toRank !== undefined && toRank > fromRank;
}

export function isPlanDowngrade(from: VerificationTier, to: VerificationTier): boolean {
  return from !== to && !isPlanUpgrade(from, to);
}

export function addBillingInterval(start: Date, interval: BillingInterval): Date {
  const next = new Date(start);
  if (interval === "YEARLY") next.setUTCFullYear(next.getUTCFullYear() + 1);
  else next.setUTCMonth(next.getUTCMonth() + 1);
  return next;
}

export function addDays(start: Date, days: number): Date {
  return new Date(start.getTime() + days * DAY_MILLISECONDS);
}
