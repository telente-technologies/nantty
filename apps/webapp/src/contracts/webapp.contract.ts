import { c } from "./contractSchema.util";
import type { EndpointContract } from "./endpointContract.type";

const userSummary = c.object({ id: c.string(), name: c.string(), username: c.string(), avatarUrl: c.nullable(c.string()) });
const user = c.object({ id: c.string(), name: c.string(), username: c.string(), avatarUrl: c.nullable(c.string()), bio: c.string(), profileKind: c.string(), showsMart: c.boolean() }, ["profileKind", "showsMart"]);
const reason = c.string(["taken", "reserved", "invalid", "recently_used", "withheld"]);
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
const boostOptions = c.object({ minimumDailyBudget: money, suggestedDailyBudgets: c.array(money), durationDayOptions: c.array(c.number()), interests: c.array(c.string()), paymentMethods: c.array(c.string(["card", "balance", "free"])), freeBoost });

const linkedProfiles = c.object({
  accountId: c.string(),
  items: c.array(c.object({ kind: c.string(["store", "business", "brand"]), profileId: c.string(), storeId: c.nullable(c.string()), status: c.string(["active", "held", "retired"]), holdReason: c.nullable(c.string()), name: c.string(), handle: c.string(), showsMart: c.boolean() })),
  canCreate: c.object({ store: c.boolean(), business: c.boolean(), brand: c.boolean() }),
  choiceRequired: c.boolean(),
});

const affiliateLinkClick = c.object({ productId: c.string(), attribution: c.object({ source: c.string(["link"]), id: c.string() }), attributionWindowDays: c.number(), expiresAt: c.string() });

export const webappContracts: readonly EndpointContract[] = [
  { domain: "commerce", method: "POST", path: "/api/v1/affiliate-links/link_dress/clicks", schema: affiliateLinkClick },
  { domain: "auth", method: "POST", path: "/api/v1/auth/login", body: { identifier: "zudomart@test.com", password: "x" }, schema: c.object({ accessToken: c.string(), refreshToken: c.string(), user }) },
  { domain: "auth", method: "GET", path: "/api/v1/auth/username-available?username=admin", schema: c.object({ available: c.boolean(), reason }, []) },
  { domain: "users", method: "GET", path: "/api/v1/users/me", schema: user },
  { domain: "subscriptionOffers", method: "GET", path: "/api/v1/subscription-offers/Xq3v0mZp9bT2nR8kL5wA7cD1eF4gH6jK0lM2nP4qR6s", schema: c.object({ state: c.string(["available", "reserved_by_you", "claimed_by_you", "expired", "revoked", "fully_claimed", "not_for_profile", "wrong_currency"]), discount: c.object({ kind: c.string(["percentage", "fixed_amount"]), percentOff: c.number(), amountOff: money }, ["percentOff", "amountOff"]), plans: c.array(c.object({ planCode: c.string(), planLabel: c.string(), availableForProfile: c.boolean(), prices: c.array(c.object({ interval: c.string(["month", "year"]), listPrice: money, regularPrice: money, offerPrice: money, offerApplies: c.boolean() })) })), durationCycles: c.number(), singleUse: c.boolean(), expiresAt: c.nullable(c.string()), profileId: c.string(), claim: c.nullable(c.object({ id: c.string(), status: c.string(["reserved", "redeemed", "released"]), reservedUntil: c.string(), redeemedAt: c.nullable(c.string()) })) }, ["profileId"]) },
  { domain: "subscriptionOffers", method: "POST", path: "/api/v1/subscription-offers/Xq3v0mZp9bT2nR8kL5wA7cD1eF4gH6jK0lM2nP4qR6s/claim", body: { profileId: "p_me" }, schema: c.object({ id: c.string(), status: c.string(["reserved", "redeemed", "released"]), reservedUntil: c.string(), redeemedAt: c.nullable(c.string()) }) },
  { domain: "users", method: "GET", path: "/api/v1/users/me/linked-profiles", schema: linkedProfiles },
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
