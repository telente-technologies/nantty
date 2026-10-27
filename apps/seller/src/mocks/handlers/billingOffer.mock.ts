import { randomBytes } from "node:crypto";

import { readMockDatabase } from "@/mocks/mockDatabase.mock";
import { MockHttpError, readJsonObjectBody, requireMockStorePrincipal, respondWithJson } from "@/mocks/mockResponses.mock";
import { registerMockRoute, type MockRequest } from "@/mocks/mockRouter.mock";
import type { ActiveTrial, BillingOffer, TrialIneligibleReason } from "@/types/billingOffer.type";

const dayMs = 86_400_000;
const trialDays = 7;
const yearlyDiscountPercent = 20;
const verificationCharge = { amountMinor: 5_000, currency: "NGN" } as const;
const goldOnlyMonthlyMinor = 300_000;

interface TrialState {
  trial: { planId: string; tier: "PRO" | "BUSINESS"; interval: "month" | "year"; startedAt: string; endsAt: string; isCancelled: boolean; priceMinor: number } | null;
  goldOnlyActive: boolean;
  readonly hasActiveBlue: boolean;
  readonly signals: { readonly accountAgeDays: number; readonly emailVerified: boolean; readonly completedOrders: number; readonly riskScore: number; readonly priorUse: "CARD" | "PHONE" | "DEVICE" | null };
}

interface BillingHolder {
  states: Map<string, TrialState>;
  pending: Map<string, { storeId: string; planId: string; kind: "trial" | "gold_only" }>;
}

const holder = globalThis as typeof globalThis & { __nanttySellerBilling?: BillingHolder };

function readHolder(): BillingHolder {
  holder.__nanttySellerBilling ??= { states: new Map(), pending: new Map() };
  return holder.__nanttySellerBilling;
}

function seedState(storeId: string): TrialState {
  const base = { goldOnlyActive: false, signals: { accountAgeDays: 210, emailVerified: true, completedOrders: 46, riskScore: 11, priorUse: null } } as const;
  if (storeId === "store_kelechi_kicks") {
    return { ...base, hasActiveBlue: false, trial: { planId: "pro_monthly", tier: "PRO", interval: "month", startedAt: new Date(Date.now() - 5 * dayMs).toISOString(), endsAt: new Date(Date.now() + 2 * dayMs - 3_600_000).toISOString(), isCancelled: false, priceMinor: 500_000 } };
  }
  return { ...base, hasActiveBlue: storeId === "store_funmi_bakes" || storeId === "store_adire_lab_studio", trial: null };
}

function readState(storeId: string): TrialState {
  const states = readHolder().states;
  if (!states.has(storeId)) states.set(storeId, seedState(storeId));
  return states.get(storeId) as TrialState;
}

function readGateStore(request: MockRequest) {
  const principal = requireMockStorePrincipal(request);
  const gateStore = readMockDatabase().gateStores.find((store) => store.storeId === principal.storeId);
  if (!gateStore) throw new MockHttpError(404, "STORE_NOT_FOUND", "Store not found.");
  return { principal, gateStore, state: readState(gateStore.storeId) };
}

function describeIneligibility(state: TrialState, hasPaidPlan: boolean): TrialIneligibleReason[] {
  const reasons: TrialIneligibleReason[] = [];
  if (hasPaidPlan) reasons.push({ code: "ALREADY_PAID", message: "You are already on a paid plan, so there is nothing to try. You can switch plans any time." });
  if (state.trial) reasons.push({ code: "ALREADY_USED_TRIAL", message: "This store is already in a free trial, and each store gets one." });
  if (state.signals.accountAgeDays < 7) reasons.push({ code: "ACCOUNT_TOO_NEW", message: "Your account is quite new. Free trials open up once it is a week old, so please check back soon." });
  if (!state.signals.emailVerified) reasons.push({ code: "EMAIL_NOT_VERIFIED", message: "Please verify your account email first. We use it for your receipts and trial reminders." });
  if (state.signals.priorUse) reasons.push({ code: "PRIOR_TRIAL", message: `A free trial was already used with this ${state.signals.priorUse.toLowerCase()}. Free trials are limited to one per person, card, device and phone, but you can subscribe any time.` });
  if (state.signals.riskScore > 50) reasons.push({ code: "UNDER_REVIEW", message: "We cannot offer a free trial on this account right now. You can still subscribe to any plan." });
  return reasons;
}

function presentActiveTrial(state: TrialState): ActiveTrial | null {
  const trial = state.trial;
  if (!trial) return null;
  const ends = Date.parse(trial.endsAt);
  return { planId: trial.planId, tier: trial.tier, interval: trial.interval, startedAt: trial.startedAt, endsAt: trial.endsAt, daysLeft: Math.max(0, Math.ceil((ends - Date.now()) / dayMs)), isCancelled: trial.isCancelled, cardSummary: "Visa •••• 4081", priceAfterTrial: { amountMinor: trial.priceMinor, currency: "NGN" as const }, verificationCharge: { amount: verificationCharge, status: "REFUNDED" }, reminders: [{ daysBefore: 3, sendsAt: new Date(ends - 3 * dayMs).toISOString() }, { daysBefore: 1, sendsAt: new Date(ends - dayMs).toISOString() }] };
}

function presentOffer(request: MockRequest): BillingOffer {
  const { principal, gateStore, state } = readGateStore(request);
  const user = readMockDatabase().users.find((candidate) => candidate.id === principal.userId);
  const hasPaidPlan = gateStore.subscription.subscription?.status === "active";
  const reasons = describeIneligibility(state, hasPaidPlan);
  return {
    profileName: gateStore.storeName, accountEmail: user?.email ?? "", trialLength: "DAYS_7", trialDays, yearlyDiscountPercent, verificationCharge,
    isEligible: reasons.length === 0, ineligibleReasons: reasons, activeTrial: presentActiveTrial(state),
    bundle: { hasActiveBlue: state.hasActiveBlue, discountPercent: 15, maximumBusinesses: 3 },
    goldOnlyPlan: { monthly: { amountMinor: goldOnlyMonthlyMinor, currency: "NGN" as const }, yearly: { amountMinor: Math.round(goldOnlyMonthlyMinor * 12 * (1 - yearlyDiscountPercent / 100)), currency: "NGN" }, isActive: state.goldOnlyActive },
  };
}

export function registerBillingOfferMockHandlers(): void {
  registerMockRoute("GET", "/seller/subscription/trial", (request) => respondWithJson(200, presentOffer(request)));

  registerMockRoute("POST", "/seller/subscription/trial/checkout", (request) => {
    const { gateStore } = readGateStore(request);
    const offer = presentOffer(request);
    const body = readJsonObjectBody(request);
    const planId = String(body.planId ?? "");
    const isGoldOnly = planId === "gold_only_monthly" || planId === "gold_only_yearly";
    if (!isGoldOnly && !readMockDatabase().subscriptionPlans.some((plan) => plan.id === planId)) throw new MockHttpError(404, "PLAN_NOT_FOUND", "Pick one of the listed plans.");
    if (!isGoldOnly && !offer.isEligible) throw new MockHttpError(409, "TRIAL_NOT_AVAILABLE", offer.ineligibleReasons[0]?.message ?? "A free trial is not available.");
    const reference = `${isGoldOnly ? "GLD" : "TRL"}_${randomBytes(8).toString("hex").toUpperCase()}`;
    readHolder().pending.set(reference, { storeId: gateStore.storeId, planId, kind: isGoldOnly ? "gold_only" : "trial" });
    return respondWithJson(201, { checkoutUrl: `/billing-checkout/demo?reference=${reference}`, authorizationUrl: `/billing-checkout/demo?reference=${reference}`, reference, provider: "flutterwave" });
  });

  registerMockRoute("POST", "/seller/subscription/trial/verify", (request) => {
    const { gateStore, state } = readGateStore(request);
    const reference = String(readJsonObjectBody(request).reference ?? "");
    const pending = readHolder().pending.get(reference);
    if (!pending || pending.storeId !== gateStore.storeId) throw new MockHttpError(404, "PAYMENT_NOT_FOUND", "We could not find that card setup. Nothing was charged beyond the small refunded check.");
    readHolder().pending.delete(reference);
    if (pending.kind === "gold_only") {
      state.goldOnlyActive = true;
      return respondWithJson(200, presentOffer(request));
    }
    const plan = readMockDatabase().subscriptionPlans.find((candidate) => candidate.id === pending.planId);
    if (!plan) throw new MockHttpError(404, "PLAN_NOT_FOUND", "That plan is no longer available.");
    const endsAt = new Date(Date.now() + trialDays * dayMs).toISOString();
    state.trial = { planId: plan.id, tier: plan.tier, interval: plan.interval, startedAt: new Date().toISOString(), endsAt, isCancelled: false, priceMinor: plan.price.amountMinor };
    gateStore.subscription = { ...gateStore.subscription, subscription: { status: "trialing", plan: plan.tier, currentPeriodEnd: endsAt }, planId: plan.id, cancelAtPeriodEnd: false, provider: "flutterwave", paymentMethodSummary: "Visa •••• 4081" };
    return respondWithJson(200, presentOffer(request));
  });

  registerMockRoute("POST", "/seller/subscription/trial/cancel", (request) => {
    const { gateStore, state } = readGateStore(request);
    if (!state.trial) throw new MockHttpError(409, "NO_TRIAL", "There is no free trial to cancel.");
    state.trial.isCancelled = true;
    gateStore.subscription = { ...gateStore.subscription, cancelAtPeriodEnd: true };
    return respondWithJson(200, presentOffer(request));
  });
}
