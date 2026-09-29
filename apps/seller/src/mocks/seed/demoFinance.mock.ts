import type { Money } from "@/types/money.type";
import type { OnlineOrder } from "@/types/order.type";
import type { Promotion } from "@/types/promotion.type";
import type { SubscriptionDetails, SubscriptionPlan } from "@/types/subscription.type";
import type { Payout, PayoutAccount, WalletBalances, WalletTransaction } from "@/types/wallet.type";
import type { AuditLogEntry } from "@/types/staff.type";
import type { VerificationStatus } from "@/types/sellerAccess.type";
import { buildIsoDateDaysAgo } from "@/mocks/seed/seededRandom.mock";

function naira(amountMinor: number): Money {
  return { amountMinor, currency: "NGN" };
}

export function buildDemoSubscriptionPlans(): SubscriptionPlan[] {
  return [
    { id: "plan_starter", name: "Starter", tagline: "One shop, one till.", price: naira(1_500_000), interval: "month", trialDays: 14, limits: { locations: 1, registers: 1, staff: 3, products: 500 }, features: ["Point of sale with offline mode", "Online marketplace sync", "Basic reports", "Email receipts"], recommended: false },
    { id: "plan_growth", name: "Growth", tagline: "For busy shops and small chains.", price: naira(4_500_000), interval: "month", trialDays: 14, limits: { locations: 3, registers: 6, staff: 15, products: 5000 }, features: ["Everything in Starter", "Multiple locations and stock transfers", "Staff roles and cashier PINs", "Loyalty points and promotions", "Ads manager and affiliates"], recommended: true },
    { id: "plan_business", name: "Business", tagline: "Unlimited stores and staff.", price: naira(12_000_000), interval: "month", trialDays: 14, limits: { locations: null, registers: null, staff: null, products: null }, features: ["Everything in Growth", "Unlimited locations and registers", "Priority support", "Advanced reports and exports"], recommended: false },
    { id: "plan_growth_yearly", name: "Growth (yearly)", tagline: "Two months free.", price: naira(45_000_000), interval: "year", trialDays: 14, limits: { locations: 3, registers: 6, staff: 15, products: 5000 }, features: ["Everything in Growth", "Billed once a year"], recommended: false },
  ];
}

export interface MockGateStore {
  readonly storeId: string;
  readonly storeName: string;
  verificationStatus: VerificationStatus;
  verificationNote: string | null;
  subscription: SubscriptionDetails;
}

export function buildDemoGateStores(): MockGateStore[] {
  const noSubscription: SubscriptionDetails = { status: "none", plan: null, currentPeriodEnd: null, cancelAtPeriodEnd: false, paymentMethodSummary: null, provider: null, invoices: [] };
  return [
    {
      storeId: "store_ife_lifestyle",
      storeName: "Ìfẹ́ Lifestyle",
      verificationStatus: "verified",
      verificationNote: null,
      subscription: {
        status: "active",
        plan: { id: "plan_growth", name: "Growth" },
        currentPeriodEnd: buildIsoDateDaysAgo(-18, 0),
        cancelAtPeriodEnd: false,
        paymentMethodSummary: "Visa •••• 4081",
        provider: "paystack",
        invoices: [0, 1, 2].map((monthsAgo) => ({ id: `inv_${monthsAgo}`, number: `ZD-INV-2026-${String(9 - monthsAgo).padStart(4, "0")}`, amount: naira(4_500_000), status: "paid" as const, periodStart: buildIsoDateDaysAgo(12 + monthsAgo * 30), periodEnd: buildIsoDateDaysAgo(-18 + monthsAgo * 30), paidAt: buildIsoDateDaysAgo(12 + monthsAgo * 30) })),
      },
    },
    { storeId: "store_kelechi_kicks", storeName: "Kelechi Kicks", verificationStatus: "pending", verificationNote: "We are checking your CAC certificate. This usually takes 1–2 working days.", subscription: noSubscription },
    { storeId: "store_funmi_bakes", storeName: "Funmi Bakes", verificationStatus: "verified", verificationNote: null, subscription: noSubscription },
  ];
}

export function buildDemoPromotions(): Promotion[] {
  return [
    { id: "promo_welcome", name: "Welcome 10%", kind: "coupon", code: "WELCOME10", discount: { kind: "percent", value: 1000 }, scope: { kind: "all", ids: [] }, minimumSpend: naira(1_000_000), usageLimit: null, usageLimitPerCustomer: 1, usedCount: 38, channels: ["online", "pos"], startsAt: buildIsoDateDaysAgo(90), endsAt: null, status: "active", createdAt: buildIsoDateDaysAgo(90) },
    { id: "promo_detty", name: "Detty December sale", kind: "scheduled_sale", code: null, discount: { kind: "percent", value: 2000 }, scope: { kind: "categories", ids: ["cat_fashion", "cat_bags"] }, minimumSpend: null, usageLimit: null, usageLimitPerCustomer: null, usedCount: 0, channels: ["online", "pos"], startsAt: "2026-12-01T00:00:00.000Z", endsAt: "2026-12-31T23:59:59.000Z", status: "scheduled", createdAt: buildIsoDateDaysAgo(3) },
    { id: "promo_glow", name: "Serum bundle ₦2,000 off", kind: "automatic", code: null, discount: { kind: "amount", value: 200_000 }, scope: { kind: "products", ids: ["prod_face_serum", "prod_body_oil"] }, minimumSpend: naira(2_500_000), usageLimit: 200, usageLimitPerCustomer: null, usedCount: 61, channels: ["online"], startsAt: buildIsoDateDaysAgo(20), endsAt: buildIsoDateDaysAgo(-10), status: "active", createdAt: buildIsoDateDaysAgo(21) },
    { id: "promo_easter", name: "Easter treats", kind: "coupon", code: "EASTER15", discount: { kind: "percent", value: 1500 }, scope: { kind: "all", ids: [] }, minimumSpend: null, usageLimit: 100, usageLimitPerCustomer: 1, usedCount: 100, channels: ["pos"], startsAt: "2026-04-01T00:00:00.000Z", endsAt: "2026-04-07T23:59:59.000Z", status: "expired", createdAt: "2026-03-25T09:00:00.000Z" },
  ];
}

export interface DemoWalletState {
  balances: WalletBalances;
  transactions: WalletTransaction[];
  payoutAccounts: PayoutAccount[];
  payouts: Payout[];
}

export function buildDemoWalletState(orders: readonly OnlineOrder[]): DemoWalletState {
  const escrowMinor = orders.filter((order) => order.escrowStatus === "held" || order.escrowStatus === "disputed").reduce((sum, order) => sum + order.sellerPayout.amountMinor, 0);
  const transactions: WalletTransaction[] = orders.slice(0, 30).map((order, index) => ({
    id: `wtx_${index + 1}`,
    kind: order.escrowStatus === "released" ? "escrow_release" : order.escrowStatus === "refunded" ? "refund" : "escrow_hold",
    description: `${order.escrowStatus === "released" ? "Escrow released" : order.escrowStatus === "refunded" ? "Refunded to buyer" : "Held in escrow"} · ${order.orderNumber}`,
    amount: order.sellerPayout,
    direction: order.escrowStatus === "refunded" ? "debit" : "credit",
    balanceBucket: order.escrowStatus === "released" ? "available" : "escrow",
    reference: order.orderNumber,
    createdAt: order.createdAt,
  }));
  const payoutAccounts: PayoutAccount[] = [
    { id: "pac_gtb", bankName: "Guaranty Trust Bank", bankCode: "058", accountNameMasked: "IFE LIFE***LE LTD", accountNumberMasked: "******4471", isDefault: true, verified: true },
    { id: "pac_opay", bankName: "OPay", bankCode: "999992", accountNameMasked: "ADAEZE O***FOR", accountNumberMasked: "******0142", isDefault: false, verified: true },
  ];
  const payouts: Payout[] = [3, 10, 17, 24].map((daysAgo, index) => ({
    id: `pyt_${index + 1}`,
    amount: naira([48_500_000, 61_200_000, 39_900_000, 52_000_000][index] ?? 0),
    fee: naira(5_000),
    accountId: "pac_gtb",
    accountSummary: "GTBank ******4471",
    status: "paid",
    reference: `PYT-${202609 - index}-${1000 + index}`,
    requestedAt: buildIsoDateDaysAgo(daysAgo, 10),
    completedAt: buildIsoDateDaysAgo(daysAgo, 10, 7),
  }));
  return {
    balances: { escrow: naira(escrowMinor), pending: naira(18_450_000), available: naira(73_280_000), nextEscrowReleaseAt: buildIsoDateDaysAgo(-1, 9) },
    transactions,
    payoutAccounts,
    payouts,
  };
}

export function buildDemoAuditLog(): AuditLogEntry[] {
  const entries: [string, string, string, string, number][] = [
    ["stf_adaeze", "staff.invited", "staff", "Invited Seun Alabi as cashier", 0],
    ["stf_tunde", "pos.discount_approved", "sale", "Approved 20% discount on IFE-1432", 0],
    ["stf_ibrahim", "inventory.adjusted", "variant", "Counted Raw Shea Butter 250g: +12 at Apapa warehouse", 1],
    ["stf_adaeze", "payout.requested", "payout", "Withdrew ₦485,000 to GTBank ******4471", 3],
    ["stf_tunde", "pos.refund_issued", "sale", "Refunded 1 × Wireless Earbuds on IFE-1398", 4],
    ["stf_adaeze", "settings.updated", "store", "Changed receipt return policy", 6],
    ["stf_ngozi", "order.shipped", "order", "Marked ZM-58244 as shipped with GIG Logistics", 7],
  ];
  const roleByStaffId: Record<string, AuditLogEntry["actor"]["role"]> = { stf_adaeze: "owner", stf_tunde: "manager", stf_ibrahim: "inventory", stf_ngozi: "support" };
  const nameByStaffId: Record<string, string> = { stf_adaeze: "Adaeze Okafor", stf_tunde: "Tunde Bakare", stf_ibrahim: "Ibrahim Musa", stf_ngozi: "Ngozi Nwosu" };
  return entries.map(([staffId, action, targetType, summary, daysAgo], index) => ({
    id: `aud_${index + 1}`,
    actor: { id: staffId, name: nameByStaffId[staffId] ?? staffId, role: roleByStaffId[staffId] ?? "manager" },
    action,
    targetType,
    targetId: null,
    summary,
    ipAddress: "102.89.23.14",
    createdAt: buildIsoDateDaysAgo(daysAgo, 10 + index),
  }));
}
