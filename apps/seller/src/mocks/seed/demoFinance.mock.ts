import type { CurrencyCode, Money } from "@/types/money.type";
import type { OnlineOrder } from "@/types/order.type";
import type { Promotion } from "@/types/promotion.type";
import type { SubscriptionDetails, SubscriptionPlan } from "@/types/subscription.type";
import type { Payout, PayoutAccount, WalletBalances, WalletTransaction } from "@/types/wallet.type";
import type { AuditLogEntry } from "@/types/staff.type";
import type { GoldEntitlements, VerificationStatus } from "@/types/sellerAccess.type";
import type { MockStaffRecord } from "@/mocks/seed/demoPeople.mock";
import { buildStoreScopedRecordId, type DemoAuditEntry, type DemoWalletPlan } from "@/mocks/seed/demoStoreProfile.mock";
import { buildIsoDateDaysAgo } from "@/mocks/seed/seededRandom.mock";

function naira(amountMinor: number): Money {
  return { amountMinor, currency: "NGN" };
}

const goldProEntitlements: GoldEntitlements = { maxStaffSeats: 5, maxLocations: 2, reducedCommission: false, priorityPlacement: false, adCredits: { amountMinor: 1_000_000, currency: "NGN" }, apiAccess: false };
const goldPremiumEntitlements: GoldEntitlements = { maxStaffSeats: 25, maxLocations: 10, reducedCommission: true, priorityPlacement: true, adCredits: { amountMinor: 5_000_000, currency: "NGN" }, apiAccess: true };

export function buildDemoSubscriptionPlans(): SubscriptionPlan[] {
  const proPerks = [
    { title: "Gold badge", description: "A gold check on your store, posts and clips." },
    { title: "Zudomart Dashboard", description: "Point of sale, stock, orders and payouts on the web." },
    { title: "Monthly ad credit", description: "Credit you can spend in Ads Manager each month." },
  ];
  const premiumPerks = [
    ...proPerks,
    { title: "Lower commission", description: "A reduced marketplace commission on every online order." },
    { title: "Priority placement", description: "Your products rank higher in Mart and search." },
    { title: "API access", description: "Connect your own tools to your store data." },
  ];
  return [
    { id: "gold_pro_monthly", tier: "PRO", price: naira(2_500_000), interval: "month", entitlements: goldProEntitlements, perks: proPerks },
    { id: "gold_premium_monthly", tier: "PREMIUM", price: naira(6_000_000), interval: "month", entitlements: goldPremiumEntitlements, perks: premiumPerks },
    { id: "gold_pro_yearly", tier: "PRO", price: naira(25_000_000), interval: "year", entitlements: goldProEntitlements, perks: proPerks },
    { id: "gold_premium_yearly", tier: "PREMIUM", price: naira(60_000_000), interval: "year", entitlements: goldPremiumEntitlements, perks: premiumPerks },
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
  const noSubscription: SubscriptionDetails = { subscription: null, planId: null, cancelAtPeriodEnd: false, paymentMethodSummary: null, provider: null, invoices: [] };
  return [
    {
      storeId: "store_ife_lifestyle",
      storeName: "Ìfẹ́ Lifestyle",
      verificationStatus: "verified",
      verificationNote: null,
      subscription: {
        subscription: { status: "active", plan: "PREMIUM", currentPeriodEnd: buildIsoDateDaysAgo(-18, 0) },
        planId: "gold_premium_monthly",
        cancelAtPeriodEnd: false,
        paymentMethodSummary: "Visa •••• 4081",
        provider: "paystack",
        invoices: [0, 1, 2].map((monthsAgo) => ({ id: `inv_${monthsAgo}`, number: `ZD-INV-2026-${String(9 - monthsAgo).padStart(4, "0")}`, amount: naira(6_000_000), status: "paid" as const, periodStart: buildIsoDateDaysAgo(12 + monthsAgo * 30), periodEnd: buildIsoDateDaysAgo(-18 + monthsAgo * 30), paidAt: buildIsoDateDaysAgo(12 + monthsAgo * 30) })),
      },
    },
    { storeId: "store_kelechi_kicks", storeName: "Kelechi Kicks", verificationStatus: "pending", verificationNote: "We are checking your CAC certificate. This usually takes 1–2 working days.", subscription: noSubscription },
    { storeId: "store_funmi_bakes", storeName: "Funmi Bakes", verificationStatus: "verified", verificationNote: null, subscription: noSubscription },
    {
      storeId: "store_adire_lab_studio",
      storeName: "Adire Lab Studio",
      verificationStatus: "verified",
      verificationNote: null,
      subscription: { subscription: { status: "active", plan: "PRO", currentPeriodEnd: buildIsoDateDaysAgo(-9, 0) }, planId: "gold_pro_monthly", cancelAtPeriodEnd: false, paymentMethodSummary: "Mastercard •••• 2210", provider: "flutterwave", invoices: [] },
    },
  ];
}

export function buildIfeLifestylePromotions(currency: CurrencyCode): Promotion[] {
  const toStoreMoney = (amountMinor: number): Money => ({ amountMinor, currency });
  return [
    { id: "promo_welcome", name: "Welcome 10%", kind: "coupon", code: "WELCOME10", discount: { kind: "percent", value: 1000 }, scope: { kind: "all", ids: [] }, minimumSpend: toStoreMoney(1_000_000), usageLimit: null, usageLimitPerCustomer: 1, usedCount: 38, channels: ["online", "pos"], startsAt: buildIsoDateDaysAgo(90), endsAt: null, status: "active", createdAt: buildIsoDateDaysAgo(90) },
    { id: "promo_detty", name: "Detty December sale", kind: "scheduled_sale", code: null, discount: { kind: "percent", value: 2000 }, scope: { kind: "categories", ids: ["cat_fashion", "cat_bags"] }, minimumSpend: null, usageLimit: null, usageLimitPerCustomer: null, usedCount: 0, channels: ["online", "pos"], startsAt: "2026-12-01T00:00:00.000Z", endsAt: "2026-12-31T23:59:59.000Z", status: "scheduled", createdAt: buildIsoDateDaysAgo(3) },
    { id: "promo_glow", name: "Serum bundle ₦2,000 off", kind: "automatic", code: null, discount: { kind: "amount", value: 200_000 }, scope: { kind: "products", ids: ["prod_face_serum", "prod_body_oil"] }, minimumSpend: toStoreMoney(2_500_000), usageLimit: 200, usageLimitPerCustomer: null, usedCount: 61, channels: ["online"], startsAt: buildIsoDateDaysAgo(20), endsAt: buildIsoDateDaysAgo(-10), status: "active", createdAt: buildIsoDateDaysAgo(21) },
    { id: "promo_easter", name: "Easter treats", kind: "coupon", code: "EASTER15", discount: { kind: "percent", value: 1500 }, scope: { kind: "all", ids: [] }, minimumSpend: null, usageLimit: 100, usageLimitPerCustomer: 1, usedCount: 100, channels: ["pos"], startsAt: "2026-04-01T00:00:00.000Z", endsAt: "2026-04-07T23:59:59.000Z", status: "expired", createdAt: "2026-03-25T09:00:00.000Z" },
  ];
}

export interface DemoWalletState {
  balances: WalletBalances;
  transactions: WalletTransaction[];
  payoutAccounts: PayoutAccount[];
  payouts: Payout[];
}

export function buildDemoWalletState(orders: readonly OnlineOrder[], plan: DemoWalletPlan, recordKey: string | null, currency: CurrencyCode): DemoWalletState {
  const toStoreMoney = (amountMinor: number): Money => ({ amountMinor, currency });
  const escrowMinor = orders.filter((order) => order.escrowStatus === "held" || order.escrowStatus === "disputed").reduce((sum, order) => sum + order.sellerPayout.amountMinor, 0);
  const transactions: WalletTransaction[] = orders.slice(0, 30).map((order, index) => ({
    id: buildStoreScopedRecordId("wtx", recordKey, index + 1),
    kind: order.escrowStatus === "released" ? "escrow_release" : order.escrowStatus === "refunded" ? "refund" : "escrow_hold",
    description: `${order.escrowStatus === "released" ? "Escrow released" : order.escrowStatus === "refunded" ? "Refunded to buyer" : "Held in escrow"} · ${order.orderNumber}`,
    amount: order.sellerPayout,
    direction: order.escrowStatus === "refunded" ? "debit" : "credit",
    balanceBucket: order.escrowStatus === "released" ? "available" : "escrow",
    reference: order.orderNumber,
    createdAt: order.createdAt,
  }));
  const defaultAccount = plan.payoutAccounts.find((account) => account.isDefault) ?? plan.payoutAccounts[0];
  const payouts: Payout[] = defaultAccount
    ? plan.payoutAmountsMinor.map((amountMinor, index) => {
        const daysAgo = 3 + index * 7;
        return {
          id: buildStoreScopedRecordId("pyt", recordKey, index + 1),
          amount: toStoreMoney(amountMinor),
          fee: toStoreMoney(plan.payoutFeeMinor),
          accountId: defaultAccount.id,
          accountSummary: plan.payoutAccountSummary,
          status: "paid",
          reference: `PYT-${202609 - index}-${1000 + index}${recordKey ? `-${recordKey.toUpperCase()}` : ""}`,
          requestedAt: buildIsoDateDaysAgo(daysAgo, 10),
          completedAt: buildIsoDateDaysAgo(daysAgo, 10, 7),
        };
      })
    : [];
  return {
    balances: { escrow: toStoreMoney(escrowMinor), pending: toStoreMoney(plan.pendingMinor), available: toStoreMoney(plan.availableMinor), nextEscrowReleaseAt: buildIsoDateDaysAgo(-1, 9) },
    transactions,
    payoutAccounts: [...plan.payoutAccounts],
    payouts,
  };
}

export function buildDemoAuditLog(entries: readonly DemoAuditEntry[], staff: readonly MockStaffRecord[], recordKey: string | null): AuditLogEntry[] {
  return entries.map(([staffId, action, targetType, summary, daysAgo], index) => {
    const actor = staff.find((member) => member.id === staffId);
    return {
      id: buildStoreScopedRecordId("aud", recordKey, index + 1),
      actor: { id: staffId, name: actor?.name ?? staffId, role: actor?.role ?? "manager" },
      action,
      targetType,
      targetId: null,
      summary,
      ipAddress: "102.89.23.14",
      createdAt: buildIsoDateDaysAgo(daysAgo, 10 + index),
    };
  });
}
