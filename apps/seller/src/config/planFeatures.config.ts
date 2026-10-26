import type { SellerAccess } from "@/types/sellerAccess.type";

export const sellerPlans = ["free", "pro", "business"] as const;
export type SellerPlan = (typeof sellerPlans)[number];

export const sellerPlanLabels: Record<SellerPlan, string> = { free: "Free", pro: "Pro", business: "Business" };

export const planFeatures = [
  "shipping_rules",
  "advanced_inventory",
  "bulk_tools",
  "advanced_analytics",
  "advanced_reports",
  "customer_segments",
  "team",
  "advanced_promotions",
  "ads_tools",
  "multiple_warehouses",
  "automated_alerts",
  "api_webhooks",
  "multiple_stores",
  "advanced_permissions",
  "accounting_integrations",
] as const;
export type PlanFeature = (typeof planFeatures)[number];

export const minimumPlanByFeature: Record<PlanFeature, SellerPlan> = {
  shipping_rules: "free",
  advanced_inventory: "pro",
  bulk_tools: "pro",
  advanced_analytics: "pro",
  advanced_reports: "pro",
  customer_segments: "pro",
  team: "pro",
  advanced_promotions: "pro",
  ads_tools: "pro",
  multiple_warehouses: "pro",
  automated_alerts: "pro",
  api_webhooks: "pro",
  multiple_stores: "business",
  advanced_permissions: "business",
  accounting_integrations: "business",
};

export const planFeatureDescriptions: Record<PlanFeature, { readonly title: string; readonly description: string }> = {
  shipping_rules: { title: "Shipping rules", description: "Fees and free shipping by state and local government area." },
  advanced_inventory: { title: "Advanced inventory", description: "Stock movements, transfers, suppliers and reorder levels." },
  bulk_tools: { title: "Bulk tools", description: "Import, export and edit many products at once." },
  advanced_analytics: { title: "Advanced analytics", description: "Breakdowns by category, location and hour, plus longer date ranges." },
  advanced_reports: { title: "Advanced reports", description: "Every report, in CSV, Excel and PDF." },
  customer_segments: { title: "Customer segments", description: "Group customers by spend and recency." },
  team: { title: "Team members", description: "Add Nantty users to your team with roles." },
  advanced_promotions: { title: "Advanced promotions", description: "Flash sales, bundles and featured products." },
  ads_tools: { title: "Ads tools", description: "See ad spend, clicks and attributed orders here." },
  multiple_warehouses: { title: "Multiple warehouses", description: "Hold stock in more than one location." },
  automated_alerts: { title: "Automated alerts", description: "Low-stock and order alerts by email and SMS." },
  api_webhooks: { title: "API and webhooks", description: "Connect your own tools with API keys and webhooks." },
  multiple_stores: { title: "Multiple stores", description: "Run several stores from one account." },
  advanced_permissions: { title: "Advanced permissions", description: "Turn individual permissions on or off per team member." },
  accounting_integrations: { title: "Accounting integrations", description: "Sync sales and payouts to your accounting software." },
};

export interface SellerPlanLimits {
  readonly maxActiveProducts: number | null;
  readonly maxStaffSeats: number;
  readonly maxLocations: number;
  readonly analyticsHistoryDays: number;
}

export const planLimitsByPlan: Record<SellerPlan, SellerPlanLimits> = {
  free: { maxActiveProducts: 100, maxStaffSeats: 0, maxLocations: 1, analyticsHistoryDays: 30 },
  pro: { maxActiveProducts: 2_000, maxStaffSeats: 5, maxLocations: 3, analyticsHistoryDays: 365 },
  business: { maxActiveProducts: null, maxStaffSeats: 25, maxLocations: 10, analyticsHistoryDays: 730 },
};

export function convertAccessToSellerPlan(access: Pick<SellerAccess, "subscription"> | null | undefined): SellerPlan {
  const subscription = access?.subscription;
  if (!subscription || (subscription.status !== "active" && subscription.status !== "trialing" && subscription.status !== "past_due")) return "free";
  return subscription.plan === "BUSINESS" ? "business" : "pro";
}

export function isPlanAtLeast(currentPlan: SellerPlan, requiredPlan: SellerPlan): boolean {
  return sellerPlans.indexOf(currentPlan) >= sellerPlans.indexOf(requiredPlan);
}

export function isFeatureIncludedInPlan(feature: PlanFeature, plan: SellerPlan): boolean {
  return isPlanAtLeast(plan, minimumPlanByFeature[feature]);
}

export function listFeaturesUnlockedByPlan(plan: SellerPlan): PlanFeature[] {
  return planFeatures.filter((feature) => minimumPlanByFeature[feature] === plan);
}

export const paidPlanCheckmarkNote = "Gold business checkmark after business verification";

export const freePlanPromise = "Free for every Nantty seller — upgrade to Pro or Business when you grow.";

export const planHighlightsByPlan: Record<SellerPlan, readonly string[]> = {
  free: [
    "Every order from the Nantty app, with escrow and payouts",
    "Up to 100 active products, with variants and photos",
    "Stock levels and low-stock warnings",
    "Customers, messages, reviews and delivery",
    "Shipping rules by state and local government area",
    "Overview and 30 days of sales analytics",
  ],
  pro: [
    paidPlanCheckmarkNote,
    "Up to 2,000 active products and 3 locations",
    "Up to 5 team members with roles",
    "Bulk import, export and editing",
    "Advanced inventory, analytics, reports and segments",
    "Flash sales, bundles, ads results and automated alerts",
    "API keys and webhooks",
  ],
  business: [
    paidPlanCheckmarkNote,
    "Unlimited products, up to 10 locations and 25 team members",
    "Run several stores from one account",
    "Per-person permission controls",
    "Accounting integrations",
    "Everything in Pro",
  ],
};
