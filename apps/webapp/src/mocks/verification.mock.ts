import { ApiError } from "@/errors/api.error";
import type { MyVerification, VerificationApplicationInput, VerificationPlan } from "@/types/verification.type";

import { getSignedInMockUser, isoDateHoursAgo } from "./fixtures.mock";
import { convertUsdCentsToViewerCurrency } from "./locale.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";

const PLAN_SEEDS = [
  { id: "vp_blue_verified", color: "blue", tier: "VERIFIED", usdCents: 399, perks: [
    { title: "Blue badge", description: "Show people it's really you, next to your name everywhere." },
    { title: "Priority support", description: "Faster answers from Zudomart support." },
    { title: "Impersonation protection", description: "We act quickly on accounts pretending to be you." },
  ] },
  { id: "vp_blue_premium", color: "blue", tier: "PREMIUM", usdCents: 999, perks: [
    { title: "Everything in Verified", description: "Blue badge, priority support and protection." },
    { title: "Boost credits", description: "Monthly credits to promote your posts." },
    { title: "Longer lives and uploads", description: "Go live for longer and post longer clips." },
    { title: "Up to 5 business profiles", description: "Run up to 5 business profiles, with one store." },
    { title: "One Gold plan for all your businesses, up to 16% off", description: "Cover up to 5 businesses with one Gold plan." },
  ] },
  { id: "vp_gold_pro", color: "gold", tier: "PRO", usdCents: 1_999, perks: [
    { title: "Gold business badge", description: "Buyers see you're a verified business." },
    { title: "Zudomart Dashboard", description: "Point of sale, advanced inventory, staff and reports on the web." },
    { title: "Lower escrow fee", description: "A reduced platform fee on every sale." },
  ] },
  { id: "vp_gold_premium", color: "gold", tier: "PREMIUM", usdCents: 4_999, perks: [
    { title: "Everything in Pro", description: "Gold badge, Dashboard access and lower fees." },
    { title: "Multiple locations", description: "Manage several shops and warehouses." },
    { title: "Account manager", description: "A dedicated contact for your business." },
  ] },
] as const;

const buildPlans = (): VerificationPlan[] =>
  PLAN_SEEDS.map((seed) => ({ id: seed.id, color: seed.color, tier: seed.tier, price: convertUsdCentsToViewerCurrency(seed.usdCents), interval: "month", perks: seed.perks }));

const verificationStateByUserId = new Map<string, MyVerification>();

const defaultStateFor = (userId: string): MyVerification => {
  const user = getSignedInMockUser();
  if (userId === "u_me") {
    return {
      current: user.verification ?? null,
      subscription: { planId: "vp_gold_pro", status: "active", renewsAt: isoDateHoursAgo(-24 * 12), cancelAtPeriodEnd: false },
      application: { id: "va_me", color: "gold", status: "approved", submittedAt: "2025-03-20T10:00:00.000Z", rejectionReason: null },
    };
  }
  return { current: null, subscription: null, application: null };
};

const myState = () => {
  const userId = getSignedInMockUser().id;
  if (!verificationStateByUserId.has(userId)) verificationStateByUserId.set(userId, defaultStateFor(userId));
  return verificationStateByUserId.get(userId)!;
};

const dismissedCheckmarkSuggestionColors = new Set<string>();

export const verificationMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/verification/plans", () => buildPlans()),
  createMockRoute("GET", "/api/v1/verification/me", () => myState()),
  createMockRoute("GET", "/api/v1/verification/suggestions", () => [{ color: "blue", eligible: false, dismissed: dismissedCheckmarkSuggestionColors.has("blue"), headline: "You may qualify for a verified checkmark", detail: "Keep going.", rules: [] }]),
  createMockRoute("POST", "/api/v1/verification/suggestions/:color/dismiss", ({ params }) => {
    dismissedCheckmarkSuggestionColors.add(params.color ?? "");
  }),
  createMockRoute("GET", "/api/v1/verification/discounts", () => ({
    offers: myState().current ? [] : [{ linkId: "offer_link_welcome", token: "mockWelcomeOfferToken0000000000000000000000", plans: [{ planCode: "blue", planLabel: "Blue Verified" }], discount: { kind: "percentage", percentOff: 40 }, durationCycles: 1, expiresAt: null, sentAt: "2026-10-10T09:00:00.000Z" }],
    yearlyPercentOff: 20,
    bundle: null,
  })),
  createMockRoute("POST", "/api/v1/verification/applications", ({ body }) => {
    const input = body as VerificationApplicationInput;
    const plan = PLAN_SEEDS.find((seed) => seed.id === input.planId && seed.color === input.kind);
    if (!plan) throw new ApiError(422, "Choose a plan");
    if (input.kind === "blue" && (!input.identityDocument.documentPhotoUrl || !input.selfiePhotoUrl)) throw new ApiError(422, "Add your ID and a selfie");
    if (input.kind === "gold" && input.documentUrls.length === 0) throw new ApiError(422, "Add your business documents");
    const applicationId = `va_${Date.now()}`;
    verificationStateByUserId.set(getSignedInMockUser().id, {
      current: myState().current,
      subscription: { planId: plan.id, status: "active", renewsAt: isoDateHoursAgo(-24 * 30), cancelAtPeriodEnd: false },
      application: { id: applicationId, color: input.kind, status: "pending", submittedAt: new Date().toISOString(), rejectionReason: null },
    });
    return { applicationId, checkoutUrl: `https://checkout.flutterwave.com/v3/hosted/pay/mock-verification-${applicationId}` };
  }),
  createMockRoute("POST", "/api/v1/verification/subscription/cancel", () => {
    const state = myState();
    if (!state.subscription) throw new ApiError(409, "You don't have an active subscription");
    const updated = { ...state, subscription: { ...state.subscription, cancelAtPeriodEnd: true } };
    verificationStateByUserId.set(getSignedInMockUser().id, updated);
    return updated;
  }),
];
