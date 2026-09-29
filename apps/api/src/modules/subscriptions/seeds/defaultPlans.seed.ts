import type { EntitlementKey, EntitlementValue } from "../../../interfaces/entitlements.interface.js";
import type { PlanPerk, PlanPrice, PlanRecord } from "../models/subscriptions.model.js";

function prices(monthlyNaira: number, monthlyUsDollarCents: number): readonly PlanPrice[] {
  return [
    { interval: "MONTHLY", currency: "NGN", amount: monthlyNaira * 100 },
    { interval: "YEARLY", currency: "NGN", amount: monthlyNaira * 100 * 10 },
    { interval: "MONTHLY", currency: "USD", amount: monthlyUsDollarCents },
    { interval: "YEARLY", currency: "USD", amount: monthlyUsDollarCents * 10 },
  ];
}

function entitlements(values: Readonly<Partial<Record<EntitlementKey, EntitlementValue>>>) {
  return Object.entries(values).map(([key, value]) => ({ key: key as EntitlementKey, value: value as EntitlementValue }));
}

function perks(...titles: readonly string[]): readonly PlanPerk[] {
  return titles.map((title) => ({ title, description: "" }));
}

const BLUE_ESSENTIAL_ENTITLEMENTS = {
  "security.two_factor_required": true,
  "security.login_alerts": true,
  "security.impersonation_protection": true,
  "ads.level": "reduced",
  "badge.visible": false,
} as const;

const BLUE_VERIFIED_ENTITLEMENTS = {
  ...BLUE_ESSENTIAL_ENTITLEMENTS,
  "badge.visible": true,
  "support.priority": true,
  "posts.max_video_seconds": 600,
  "posts.edit_window_minutes": 60,
  "creator_program.eligible": true,
} as const;

const GOLD_PRO_ENTITLEMENTS = {
  "badge.visible": true,
  "analytics.business": true,
  "seller.dashboard": true,
  "seller.pos": true,
  "store.staff_seats": 3,
  "store.locations": 1,
} as const;

export const DEFAULT_SUBSCRIPTION_PLANS: readonly PlanRecord[] = [
  {
    id: "5a1f0c2e-0001-4b1e-9d1a-000000000001",
    color: "BLUE", tier: "ESSENTIAL", name: "Blue Essential", description: "Account security and fewer ads, without a public badge.",
    purchasable: true, trialDays: 0, active: true, sortOrder: 1,
    prices: prices(1_500, 199),
    entitlements: entitlements(BLUE_ESSENTIAL_ENTITLEMENTS),
    perks: perks("Two-factor authentication required", "Login alerts", "Impersonation protection", "Fewer ads", "No public badge"),
  },
  {
    id: "5a1f0c2e-0001-4b1e-9d1a-000000000002",
    color: "BLUE", tier: "VERIFIED", name: "Blue Verified", description: "The blue checkmark and creator tools.",
    purchasable: true, trialDays: 7, active: true, sortOrder: 2,
    prices: prices(4_500, 499),
    entitlements: entitlements(BLUE_VERIFIED_ENTITLEMENTS),
    perks: perks("Blue badge", "Priority support", "Longer videos", "Edit posts within 1 hour", "Creator Program eligible"),
  },
  {
    id: "5a1f0c2e-0001-4b1e-9d1a-000000000003",
    color: "BLUE", tier: "PREMIUM", name: "Blue Premium", description: "Everything in Verified, with no ads and more reach.",
    purchasable: true, trialDays: 7, active: true, sortOrder: 3,
    prices: prices(9_000, 999),
    entitlements: entitlements({ ...BLUE_VERIFIED_ENTITLEMENTS, "ads.level": "none", "reach.boost": true, "analytics.profile": true, "features.early_access": true }),
    perks: perks("Everything in Blue Verified", "No ads", "Reach boost", "Profile analytics", "Early access to features"),
  },
  {
    id: "5a1f0c2e-0001-4b1e-9d1a-000000000004",
    color: "GOLD", tier: "PRO", name: "Gold Pro", description: "The gold checkmark and the Zudomart seller tools.",
    purchasable: true, trialDays: 14, active: true, sortOrder: 4,
    prices: prices(15_000, 1_999),
    entitlements: entitlements(GOLD_PRO_ENTITLEMENTS),
    perks: perks("Gold badge", "Business analytics", "Zudomart Dashboard and POS", "3 staff seats", "1 location"),
  },
  {
    id: "5a1f0c2e-0001-4b1e-9d1a-000000000005",
    color: "GOLD", tier: "PREMIUM", name: "Gold Premium", description: "Everything in Pro, unlimited team and better marketplace terms.",
    purchasable: true, trialDays: 14, active: true, sortOrder: 5,
    prices: prices(45_000, 4_999),
    entitlements: entitlements({
      ...GOLD_PRO_ENTITLEMENTS,
      "store.staff_seats": -1,
      "store.locations": -1,
      "marketplace.commission_bps": 300,
      "placement.priority": true,
      "ads.monthly_credit_minor": 1_000_000,
      "api.access": true,
    }),
    perks: perks("Everything in Gold Pro", "Unlimited staff and locations", "Reduced marketplace commission", "Priority placement", "Monthly ad credits", "API access"),
  },
  {
    id: "5a1f0c2e-0001-4b1e-9d1a-000000000006",
    color: "BLACK", tier: "OFFICIAL", name: "Black Official", description: "Government profiles, granted through the official process only.",
    purchasable: false, trialDays: 0, active: true, sortOrder: 6,
    prices: [],
    entitlements: entitlements({ "badge.visible": true, "ads.level": "none", "moderation.priority": true }),
    perks: perks("Black badge", "No ads", "Priority moderation"),
  },
];
