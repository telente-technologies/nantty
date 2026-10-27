import { c } from "./contractSchema.util";
import type { EndpointContract } from "./endpointContract.type";

const userSummary = c.object({ id: c.string(), name: c.string(), username: c.string(), avatarUrl: c.nullable(c.string()) });
const user = c.object({ id: c.string(), name: c.string(), username: c.string(), avatarUrl: c.nullable(c.string()), bio: c.string(), profileKind: c.string(), showsMart: c.boolean() }, ["profileKind", "showsMart"]);
const reason = c.string(["taken", "reserved", "invalid", "recently_used", "withheld", "unavailable"]);
const money = c.object({ amountMinor: c.number(), currency: c.string() });
const walletLine = c.object({ key: c.string(), label: c.string(), description: c.string(), amount: money });
const walletSummary = c.object({
  available: money,
  pending: money,
  locked: money,
  inEscrow: money,
  payoutRequested: money,
  negativeBalance: money,
  nextAvailableAt: c.nullable(c.string()),
  adCredit: money,
  earningsPayable: money,
  debts: money,
  coins: c.object({ spendable: c.number(), earned: c.number() }),
  lines: c.array(walletLine),
  verification: c.object({ level: c.number(), withdrawalsUnlocked: c.boolean(), waitingForVerification: money, nextStep: c.nullable(c.string(["payout_setup", "bank_validation", "identity_check", "business_verification"])), message: c.nullable(c.string()) }),
});
const freeBoost = c.object({ premium: c.boolean(), eligible: c.boolean(), remainingThisMonth: c.number(), maxTotal: money, resetsAt: c.nullable(c.string()) });
const boostPaymentOption = c.object({ method: c.string(["card", "ad_balance", "balance", "free"]), available: c.boolean(), reasonCode: c.nullable(c.string()), reason: c.nullable(c.string()) });
const boostOptions = c.object({
  minimumDailyBudget: money, suggestedDailyBudgets: c.array(money), durationDayOptions: c.array(c.number()), interests: c.array(c.string()), paymentMethods: c.array(c.string(["card", "balance", "free"])), freeBoost,
  paymentOptions: c.array(boostPaymentOption),
  adBalance: c.nullable(c.object({ accountId: c.nullable(c.string()), balance: money, credit: money, committed: money, spendable: money })),
  maximumDurationDays: c.number(), maximumScheduleDays: c.number(),
  goalsByDestination: c.object({ post: c.array(c.string()), profile: c.array(c.string()), store: c.array(c.string()), product: c.array(c.string()) }),
});
const boostStatus = c.string(["pending_payment", "in_review", "active", "paused", "completed", "rejected", "cancelled"]);
export const adsHubBoostSchema = c.object({
  id: c.string(), postId: c.string(), destinationType: c.string(["post", "profile", "store", "product"]), targetId: c.string(), status: boostStatus,
  goal: c.string(["views", "profile_visits", "messages", "store_visits", "product_visits"]), budgetType: c.string(["daily", "total"]), dailyBudget: money, durationDays: c.number(),
  totalBudget: money, spent: money, startsAt: c.nullable(c.string()), endsAt: c.nullable(c.string()), scheduledStartAt: c.nullable(c.string()), createdAt: c.string(), audience: c.any(),
  results: c.object({ impressions: c.number(), reach: c.number(), clicks: c.number(), profileVisits: c.number(), storeVisits: c.number(), productVisits: c.number(), messages: c.number() }),
  keyResult: c.object({ label: c.string(), value: c.number() }), costPerResult: c.nullable(money), rejectionReason: c.nullable(c.string()), paymentMethod: c.string(["card", "ad_balance", "balance", "free", "wallet"]),
  actions: c.object({ pause: c.boolean(), resume: c.boolean(), stop: c.boolean(), changeBudget: c.boolean(), resubmit: c.boolean() }),
});
export const adsHubBudgetQuoteSchema = c.object({ additionalCost: money, newDailyBudget: money, newTotalBudget: money, newDurationDays: c.number(), newEndsAt: c.nullable(c.string()), paymentOptions: c.array(boostPaymentOption) });
export const adsHubBudgetChangeSchema = c.object({ boost: adsHubBoostSchema, change: c.object({ id: c.string(), status: c.string(["applied", "pending_payment"]), additionalCost: money }), checkoutUrl: c.nullable(c.string()) });
const reportMetrics = { impressions: c.number(), reach: c.number(), clicks: c.number(), results: c.number(), spend: money };
export const adsHubReportSchema = c.object({ currency: c.string(), resultLabel: c.string(), totals: c.object({ ...reportMetrics, costPerResult: c.nullable(money) }), series: c.array(c.object({ date: c.string(), ...reportMetrics })) });
const adBalance = c.object({
  accountId: c.nullable(c.string()), balance: money, credit: money, committed: money, spendable: money, withdrawable: money, pendingSettlement: money,
  creditLots: c.array(c.object({ id: c.string(), source: c.string(["admin_issued", "cashback", "premium_free_boost", "boost_refund", "legacy"]), remaining: money, expiresAt: c.nullable(c.string()), reason: c.nullable(c.string()), createdAt: c.string() })),
  cashback: c.object({ enabled: c.boolean(), percent: c.number() }),
  topUp: c.object({ available: c.boolean(), reasonCode: c.nullable(c.string()), reason: c.nullable(c.string()), minimum: money, maximum: money, suggested: c.array(money) }),
  withdrawal: c.object({ available: c.boolean(), reasonCode: c.nullable(c.string()), reason: c.nullable(c.string()), minimum: money }),
});
export const adsHubWithdrawalQuoteSchema = c.object({ amount: money, fee: money, net: money, destination: c.string(["wallet"]), withdrawable: money });
export const adsHubWithdrawalSchema = c.object({ id: c.string(), status: c.string(["completed"]), amount: money, fee: money, net: money, destination: c.string(["wallet"]), createdAt: c.string() });
const adBalanceTransaction = c.object({
  id: c.string(), pot: c.string(["balance", "credit"]),
  kind: c.string(["top_up", "boost_funding", "earnings_funding", "spent", "refund", "withdrawal", "credit_issued", "cashback", "cashback_reversed", "credit_spent", "credit_expired", "credit_revoked", "debt"]),
  amount: money, description: c.string(), createdAt: c.string(),
});

const linkedProfiles = c.object({
  accountId: c.string(),
  items: c.array(c.object({ kind: c.string(["store", "business", "brand"]), profileId: c.string(), storeId: c.nullable(c.string()), status: c.string(["active", "held", "retired"]), holdReason: c.nullable(c.string()), name: c.string(), handle: c.string(), showsMart: c.boolean(), ownsStore: c.boolean(), premiumNeeded: c.boolean() })),
  canCreate: c.object({ store: c.boolean(), business: c.boolean(), brand: c.boolean() }),
  choiceRequired: c.boolean(),
  businessProfiles: c.object({ count: c.number(), limit: c.number(), premiumLimit: c.number(), premium: c.boolean(), premiumNeeded: c.boolean(), storeUsed: c.boolean() }),
});

const goldBusiness = c.object({ profileId: c.string(), displayName: c.string(), profileType: c.string(["business", "brand"]), coverage: c.string(["none", "pending", "active", "removing"]), hasOwnGold: c.boolean() });
const goldLineItem = c.object({ kind: c.string(), label: c.string(), amountMinor: c.number() });
const goldDiscount = c.object({ listAmountMinor: c.number(), amountMinor: c.number(), discountKind: c.string(["multi_business", "offer", "yearly", "none"]), discountBps: c.number(), offerDiscountMinor: c.number() }, ["offerDiscountMinor"]);
export const goldForBusinessesStateSchema = c.object({
  premium: c.boolean(),
  rules: c.object({ maximumProfiles: c.number(), yearlyExtraBps: c.number(), yearlyMode: c.string(), tiers: c.array(c.object({ profiles: c.number(), discountBps: c.number() })) }),
  businesses: c.array(goldBusiness),
  subscription: c.nullable(c.object({ id: c.string(), status: c.string(), interval: c.string(["month", "year"]), price: money, discountKind: c.string(["multi_business", "offer", "yearly", "none"]), currentPeriodEnd: c.nullable(c.string()), cancelAtPeriodEnd: c.boolean(), coveredProfiles: c.array(goldBusiness) })),
});
export const goldForBusinessesQuoteSchema = c.object({
  interval: c.string(["month", "year"]), currency: c.string(), region: c.string(), unitMonthlyPrice: money, listTotal: money, total: money,
  breakdown: c.object({
    unitMonthlyMinor: c.number(), profileCount: c.number(), months: c.number(), interval: c.string(["month", "year"]), grossMinor: c.number(), tierBps: c.number(), tierDiscountMinor: c.number(),
    yearlyExtraBps: c.number(), yearlyExtraDiscountMinor: c.number(), standardYearlyBps: c.number(), standardYearlyDiscountMinor: c.number(), totalMinor: c.number(), perProfileMinor: c.array(c.number()),
  }),
  discount: goldDiscount,
  profiles: c.array(c.object({ profileId: c.string(), displayName: c.string(), profileType: c.string(), price: money })),
  lineItems: c.array(goldLineItem),
  canBuyOnWeb: c.boolean(),
  billingNote: c.string(),
}, ["billingNote"]);
export const goldForBusinessesCheckoutSchema = c.object({ subscriptionId: c.string(), authorizationUrl: c.string(), reference: c.string(), provider: c.string(), price: money, discount: goldDiscount, trial: c.boolean(), lineItems: c.array(goldLineItem), activated: c.boolean() }, ["activated"]);
export const goldForBusinessesProfilesChangeSchema = c.object({
  added: c.array(c.string()), removing: c.array(c.string()), removalsEffectiveAt: c.string(),
  charge: c.object({ lineItems: c.array(goldLineItem), subtotalMinor: c.number(), amountDueMinor: c.number(), creditAppliedMinor: c.number(), remainingCreditMinor: c.number(), checkmarkIncluded: c.boolean() }),
  chargeStatus: c.string(["succeeded", "pending", "requires_action", "failed"]), actionUrl: c.string(),
}, ["chargeStatus", "actionUrl"]);

const affiliateLinkClick = c.object({ productId: c.string(), attribution: c.object({ source: c.string(["link"]), id: c.string() }), attributionWindowDays: c.number(), expiresAt: c.string() });

export const webappContracts: readonly EndpointContract[] = [
  {
    domain: "verification",
    method: "GET",
    path: "/api/v1/verification/discounts",
    schema: c.object({
      offers: c.array(c.object({
        linkId: c.string(), token: c.string(), plans: c.array(c.object({ planCode: c.string(), planLabel: c.string() })),
        discount: c.object({ kind: c.string(["percentage", "fixed_amount"]), percentOff: c.number(), amountOff: c.object({ amountMinor: c.number(), currency: c.string() }) }, ["percentOff", "amountOff"]),
        durationCycles: c.number(), expiresAt: c.nullable(c.string()), sentAt: c.string(),
      })),
      yearlyPercentOff: c.number(),
      bundle: c.nullable(c.object({ percentOff: c.number() })),
    }),
  },
  { domain: "commerce", method: "POST", path: "/api/v1/affiliate-links/link_dress/clicks", schema: affiliateLinkClick },
  { domain: "auth", method: "POST", path: "/api/v1/auth/login", body: { identifier: "nantty@test.com", password: "x" }, schema: c.object({ accessToken: c.string(), refreshToken: c.string(), user }) },
  { domain: "auth", method: "GET", path: "/api/v1/auth/username-available?username=admin", schema: c.object({ available: c.boolean(), reason }, []) },
  { domain: "users", method: "GET", path: "/api/v1/users/me", schema: user },
  { domain: "subscriptionOffers", method: "GET", path: "/api/v1/subscription-offers/Xq3v0mZp9bT2nR8kL5wA7cD1eF4gH6jK0lM2nP4qR6s", schema: c.object({ state: c.string(["available", "reserved_by_you", "claimed_by_you", "expired", "revoked", "fully_claimed", "not_for_profile", "wrong_currency"]), discount: c.object({ kind: c.string(["percentage", "fixed_amount"]), percentOff: c.number(), amountOff: money }, ["percentOff", "amountOff"]), plans: c.array(c.object({ planCode: c.string(), planLabel: c.string(), availableForProfile: c.boolean(), prices: c.array(c.object({ interval: c.string(["month", "year"]), listPrice: money, regularPrice: money, offerPrice: money, offerApplies: c.boolean() })) })), durationCycles: c.number(), singleUse: c.boolean(), expiresAt: c.nullable(c.string()), profileId: c.string(), claim: c.nullable(c.object({ id: c.string(), status: c.string(["reserved", "redeemed", "released"]), reservedUntil: c.string(), redeemedAt: c.nullable(c.string()) })) }, ["profileId"]) },
  { domain: "subscriptionOffers", method: "POST", path: "/api/v1/subscription-offers/Xq3v0mZp9bT2nR8kL5wA7cD1eF4gH6jK0lM2nP4qR6s/claim", body: { profileId: "p_me" }, schema: c.object({ id: c.string(), status: c.string(["reserved", "redeemed", "released"]), reservedUntil: c.string(), redeemedAt: c.nullable(c.string()) }) },
  { domain: "users", method: "GET", path: "/api/v1/users/me/linked-profiles", schema: linkedProfiles },
  { domain: "subscriptions", method: "GET", path: "/api/v1/subscriptions/gold-for-businesses", schema: goldForBusinessesStateSchema },
  { domain: "subscriptions", method: "POST", path: "/api/v1/subscriptions/gold-for-businesses/quote", body: { profileIds: ["bp_ada_foods", "bp_ada_consulting"], interval: "year" }, schema: goldForBusinessesQuoteSchema },
  { domain: "subscriptions", method: "POST", path: "/api/v1/subscriptions/gold-for-businesses/checkout", body: { profileIds: ["bp_ada_foods"], interval: "month", returnTo: "https://nantty.com/verification", expectedTotalMinor: 285_000 }, schema: goldForBusinessesCheckoutSchema },
  { domain: "subscriptions", method: "PUT", path: "/api/v1/subscriptions/gold-for-businesses/sub_gold_businesses_mock/profiles", body: { profileIds: ["bp_ada_foods", "bp_ada_consulting"] }, schema: goldForBusinessesProfilesChangeSchema },
  { domain: "places", method: "GET", path: "/api/v1/places/search?q=lagos", schema: c.object({ places: c.array(c.object({ placeId: c.string(), name: c.string(), area: c.nullable(c.string()) })) }) },
  { domain: "escrow", method: "GET", path: "/api/v1/disputes", schema: c.page(c.object({ id: c.string(), orderId: c.string(), status: c.string(["open", "awaiting_seller", "under_review", "resolved_refunded", "resolved_released", "closed"]), viewerRole: c.string(["buyer", "seller"]), statusHistory: c.array(c.any()), messages: c.array(c.any()) })) },
  { domain: "seller", method: "GET", path: "/api/v1/seller/products", schema: c.page(c.object({ id: c.string(), name: c.string(), status: c.string(["draft", "active", "archived"]), images: c.array(c.object({ mediaId: c.string(), url: c.string() })), variants: c.array(c.object({ id: c.string(), sku: c.string(), price: money })) })) },
  { domain: "users", method: "GET", path: "/api/v1/users/me/addresses", schema: c.page(c.object({ id: c.string(), line1: c.string(), city: c.string(), state: c.string(), isDefault: c.boolean() })) },
  { domain: "users", method: "GET", path: "/api/v1/locale/countries", schema: c.page(c.object({ countryCode: c.string(), countryName: c.string(), currency: c.string() })) },
  { domain: "users", method: "GET", path: "/api/v1/users/me/username-policy", schema: c.object({ username: c.string(), canChangeNow: c.boolean(), cooldownDays: c.number(), maxChangesPerYear: c.number(), quarantineDays: c.number(), history: c.array(c.any()) }) },
  {
    domain: "chatKeys",
    method: "POST",
    path: "/api/v1/chat/keys/devices/query",
    body: { userIds: ["u_21"] },
    schema: c.object({ data: c.array(c.object({ userId: c.string(), devices: c.array(c.object({ deviceId: c.string(), registrationId: c.number(), identityKey: c.string() })) })) }),
  },
  {
    domain: "chatKeys",
    method: "POST",
    path: "/api/v1/chat/keys/bundles",
    body: { devices: [{ userId: "u_21", deviceId: "unknown-device" }] },
    schema: c.object({ data: c.array(c.any()) }),
  },
  { domain: "wallets", method: "GET", path: "/api/v1/wallets/me", schema: walletSummary },
  {
    domain: "payments",
    method: "GET",
    path: "/api/v1/payments/wallet/me",
    schema: c.object({
      wallet: c.nullable(c.object({ provider: c.string(), currency: c.string(), status: c.string(), accountName: c.string(), accountNumber: c.string(), bankName: c.string(), bankCode: c.string(), fundingNumbers: c.array(c.object({ accountNumber: c.string(), bankName: c.string() })), createdAt: c.string(), frozenAt: c.nullable(c.string()) })),
      balances: c.object({ currency: c.string(), availableMinor: c.number(), depositHoldMinor: c.number(), escrowLockedMinor: c.number(), outgoingMinor: c.number(), reservedPayoutMinor: c.number(), debtMinor: c.number() }),
    }),
  },
  { domain: "payments", method: "GET", path: "/api/v1/payments/verification/me", schema: c.object({ level: c.number(), payoutVerified: c.boolean(), identityVerified: c.boolean(), country: c.string(), method: c.nullable(c.string()), nextStep: c.nullable(c.string()) }) },
  { domain: "payments", method: "GET", path: "/api/v1/payments/payout-onboarding/me/bank-validation", schema: c.object({ status: c.string() }) },
  { domain: "ads", method: "GET", path: "/api/v1/ads/boosts/options", schema: boostOptions },
  { domain: "ads", method: "GET", path: "/api/v1/ads/boosts?status=active,paused", schema: c.page(adsHubBoostSchema) },
  { domain: "ads", method: "GET", path: "/api/v1/ads/boosts/balance", schema: adBalance },
  { domain: "ads", method: "GET", path: "/api/v1/ads/boosts/balance/transactions", schema: c.page(adBalanceTransaction) },
  { domain: "ads", method: "GET", path: "/api/v1/ads/locations?search=la&countryCode=NG", schema: c.page(c.object({ type: c.string(["country", "state", "city"]), code: c.string(), name: c.string(), countryCode: c.string(), parentName: c.nullable(c.string()) })) },
  {
    domain: "ads", method: "POST", path: "/api/v1/ads/boosts/estimate",
    body: { destinationType: "profile", targetId: "u_me", goal: "profile_visits", audience: { mode: "custom", countryCode: "NG", states: ["NG-LA"], topicIds: [], gender: "female", ageMin: 18, ageMax: 34 }, budgetType: "total", dailyBudget: { amountMinor: 100_000, currency: "NGN" }, totalBudget: { amountMinor: 1_000_000, currency: "NGN" }, durationDays: 5 },
    schema: c.object({ estimatedReachMin: c.number(), estimatedReachMax: c.number(), estimatedResultsLabel: c.string(), totalCost: money }),
  },
  { domain: "live", method: "GET", path: "/api/v1/lives/suggested", schema: c.page(c.object({ id: c.string(), host: userSummary, title: c.string(), coverUrl: c.nullable(c.string()) })) },
  {
    domain: "feeds",
    method: "POST",
    path: "/api/v1/feeds/interactions/batch",
    body: { events: [{ postId: "post_1", kind: "view", surface: "feed" }, { postId: "post_missing", kind: "watch", surface: "clips", watchMs: 1000, durationMs: 1000, watchFraction: 1, loopCount: 0 }] },
    schema: c.object({ accepted: c.number(), skipped: c.number() }),
  },
  {
    domain: "posts",
    method: "GET",
    path: "/api/v1/posts/post_9/analytics",
    schema: c.object({
      postId: c.string(), kind: c.string(["post", "clip", "story"]), hasLink: c.boolean(), impressions: c.number(), uniqueViewers: c.number(), profileVisits: c.number(), linkClicks: c.number(), newFollows: c.number(),
      engagements: c.number(), engagementRate: c.number(),
      video: c.nullable(c.object({ views: c.number(), watchTimeSeconds: c.number(), averageWatchSeconds: c.number(), completedViews: c.number(), completionRate: c.number() })),
      daily: c.array(c.object({ day: c.string(), impressions: c.number() })),
    }),
  },
  {
    domain: "comments",
    method: "GET",
    path: "/api/v1/me/post-comments?filter=hidden",
    schema: c.page(c.object({
      id: c.string(), postId: c.string(), parentCommentId: c.nullable(c.string()), author: userSummary, text: c.string(), createdAt: c.string(), replyCount: c.number(),
      post: c.object({ id: c.string(), kind: c.string(), text: c.string(), thumbnailUrl: c.nullable(c.string()) }), hidden: c.boolean(), hiddenAt: c.nullable(c.string()), needsReply: c.boolean(),
    })),
  },
];
