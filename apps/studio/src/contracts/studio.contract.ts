import { c } from "./contractSchema.util";
import type { EndpointContract } from "./endpointContract.type";

const user = c.object({ id: c.string(), name: c.string(), username: c.string(), avatarUrl: c.nullable(c.string()), email: c.string() });
const session = c.object({ accessToken: c.string(), refreshToken: c.string(), user });
const liveComment = c.object({ id: c.string(), author: c.object({ id: c.string(), name: c.string(), username: c.string(), avatarUrl: c.nullable(c.string()) }), text: c.string(), createdAt: c.string() });
const liveState = c.string(["idle", "connecting", "live", "ended"]);
const productPin = c.object({ productId: c.string(), pinned: c.boolean() });
const money = c.object({ amountMinor: c.number(), currency: c.string() });
const studioLive = c.object({
  id: c.string(), title: c.string(), category: c.string(), state: liveState, createdAt: c.string(), startedAt: c.nullable(c.string()), endedAt: c.nullable(c.string()),
  viewers: c.number(), peakViewers: c.number(), streamKeyHint: c.nullable(c.string()), ingestProtocol: c.nullable(c.string()), hlsUrl: c.nullable(c.string()),
  earnings: c.object({ coins: c.number(), giftCount: c.number() }), recordEnabled: c.boolean(), visibility: c.string(), products: c.array(productPin),
});
const hostRanking = c.object({ globalRank: c.number(), categoryRank: c.nullable(c.number()), category: c.nullable(c.string()), period: c.string() });
const liveSession = c.object({ id: c.string(), title: c.string(), category: c.string(), state: liveState, viewers: c.number(), peakViewers: c.number(), startedAt: c.nullable(c.string()), endedAt: c.nullable(c.string()), playbackUrl: c.nullable(c.string()), storeId: c.nullable(c.string()), hostRanking: c.nullable(hostRanking) });
const myStore = c.object({ storeId: c.string(), storeName: c.string(), role: c.string(), isCurrent: c.boolean() });
const streamKey = c.object({ liveId: c.string(), protocol: c.string(), ingestUrl: c.string(), streamKey: c.string(), streamKeyHint: c.string(), issuedAt: c.string() });
const streamStats = c.object({ liveId: c.string(), giftCount: c.number(), totalCoins: c.number(), creatorCoins: c.number(), topSupporters: c.array(c.object({ rank: c.number(), user: c.object({ id: c.string(), name: c.string(), username: c.string() }), coins: c.number() })) });
const sellerProduct = c.object({ id: c.string(), name: c.string(), status: c.string(), images: c.array(c.object({ url: c.string() })), variants: c.array(c.object({ price: money })) });
const overlayLayer = c.object({ id: c.string(), type: c.string(), name: c.string(), x: c.number(), y: c.number(), width: c.number(), height: c.number(), zIndex: c.number(), opacity: c.number() });
const overlayScene = c.object({ id: c.string(), liveId: c.string(), name: c.string(), layers: c.array(overlayLayer) });
const bank = c.object({ code: c.string(), name: c.string(), countryCode: c.string() });
const payoutState = c.object({
  role: c.string(), status: c.string(), currentStep: c.string(["identity", "business", "bank", "document", "done"]), completedSteps: c.array(c.string()),
  bankSummary: c.nullable(c.object({ bankName: c.string(), accountLast4: c.string(), accountName: c.string() })), earningsPendingTransfer: c.nullable(money), pendingWithdrawable: c.nullable(money),
});

const walletVerification = c.object({ level: c.number(), withdrawalsUnlocked: c.boolean(), waitingForVerification: money, nextStep: c.nullable(c.string(["payout_setup", "bank_validation", "identity_check", "business_verification"])), message: c.nullable(c.string()) });
const walletSummary = c.object({
  available: money, pending: money, locked: money, inEscrow: money, payoutRequested: money, negativeBalance: money, nextAvailableAt: c.nullable(c.string()), adCredit: money, earningsPayable: money, debts: money,
  coins: c.object({ spendable: c.number(), earned: c.number() }), lines: c.array(c.object({ key: c.string(), label: c.string(), description: c.string(), amount: money })), verification: walletVerification,
});

const person = c.object({ id: c.string(), name: c.string(), username: c.string(), avatarUrl: c.nullable(c.string()) });
const dashboard = c.object({
  period: c.string(["today", "week", "month", "all"]), since: c.nullable(c.string()), currency: c.string(),
  earnings: c.object({ gifts: money, tips: money, affiliateCommissions: money, subscriptions: money, adRevenue: money, bonuses: money, total: money }),
  pendingBalance: money, availableBalance: money, followersGained: c.number(), followers: c.object({ total: c.number(), gainedInPeriod: c.nullable(c.number()) }), coins: c.object({ earned: c.number() }),
  topContent: c.array(c.object({ id: c.string(), kind: c.string(), title: c.string(), thumbnailUrl: c.nullable(c.string()), views: c.number(), earnings: money })),
});
const creatorStatus = c.object({ status: c.string(), canGoLive: c.boolean(), tier: c.string(), giftSharePercent: c.number(), suspensionReason: c.nullable(c.string()), suspendedAt: c.nullable(c.string()), recentViolations: c.number() }, ["tier"]);
const revenueRules = c.object({
  giftCreatorSharePercentUpTo: c.number(), tipCreatorSharePercent: c.number(), subscriptionCreatorSharePercent: c.number(), subscriptionShareBasis: c.string(), adsRevenueCreatorSharePercent: c.number(),
  adRevenuePolicy: c.object({ baseShareBasisPoints: c.number(), rules: c.array(c.object({ contentType: c.string(["original", "ai_generated"]), multiplierBasisPoints: c.number(), effectiveShareBasisPoints: c.number() })), calculationNote: c.string() }),
  coinTransferPlatformFeePercent: c.number(), affiliateCommissionReleasedAfterEscrow: c.boolean(), affiliateCommissionMaximumPercent: c.number(), coinCashValue: money, minimumPayout: money, withdrawalFeeDescription: c.string(),
});
const earning = c.object({ id: c.string(), kind: c.string(["gift", "tip", "subscription", "affiliate", "ad_revenue"]), source: c.string(), description: c.string(), amount: money, grossAmount: money, status: c.string(["pending", "available", "reversed"]), availableAt: c.nullable(c.string()), createdAt: c.string(), sourceRef: c.object({ type: c.string(), id: c.string() }) });
const eligibility = c.object({ eligible: c.boolean(), decision: c.string(), decisionNote: c.string(), requirements: c.array(c.object({ key: c.string(), label: c.string(), currentValue: c.number(), requiredValue: c.number(), met: c.boolean() })) });
const brandDeal = c.object({ id: c.string(), brandName: c.string(), amount: money, startsAt: c.string(), endsAt: c.nullable(c.string()), disclosure: c.string(), notes: c.string(), createdAt: c.string() });
const withdrawal = c.object({ id: c.string(), amount: money, fee: money, netAmount: money, withdrawalStatus: c.string(["pending_review", "on_hold", "queued", "processing", "paid", "failed", "cancelled"]), reference: c.string(), failureReason: c.nullable(c.string()), createdAt: c.string(), processedAt: c.nullable(c.string()) });
const plan = c.object({ id: c.string(), name: c.string(), description: c.string(), price: money, interval: c.string(["month", "year"]), benefits: c.array(c.string()), subscriberCount: c.number(), active: c.boolean() });
const priceTier = c.object({ tier: c.string(), default: c.boolean(), prices: c.object({ web: money, ios: money, android: money }) });
const subscriber = c.object({ id: c.string(), user: c.nullable(person), planId: c.string(), planName: c.string(), since: c.string(), renewsAt: c.nullable(c.string()), status: c.string(["active", "past_due", "cancelled"]) });
const myPost = c.object({ id: c.string(), kind: c.string(["post", "clip"]), createdAt: c.string(), text: c.string(), media: c.array(c.object({ type: c.string(["image", "video"]), posterUrl: c.nullable(c.string()), url: c.nullable(c.string()) })), likes: c.number(), comments: c.number(), reposts: c.number(), shares: c.number(), views: c.number(), saveCount: c.number(), durationSeconds: c.nullable(c.number()), subscriberOnly: c.boolean() });
const videoAnalytics = c.object({ views: c.number(), watchTimeSeconds: c.number(), averageWatchSeconds: c.number(), completedViews: c.number(), completionRate: c.number() });
const postAnalytics = c.object({
  postId: c.string(), kind: c.string(["post", "clip", "story"]), postedAt: c.string(), impressions: c.number(), uniqueViewers: c.number(), reach: c.number(), likes: c.number(), comments: c.number(), reposts: c.number(), shares: c.number(), saves: c.number(),
  profileVisits: c.number(), linkClicks: c.number(), newFollows: c.number(), engagements: c.number(), engagementRate: c.number(), video: c.nullable(videoAnalytics),
  audience: c.array(c.object({ label: c.string(), share: c.number() })), daily: c.array(c.object({ day: c.string(), impressions: c.number() })),
});
const follower = c.object({ id: c.string(), name: c.string(), username: c.string(), avatarUrl: c.nullable(c.string()), isFollowing: c.boolean() });
const ranking = c.object({ rank: c.number(), user: person, points: c.number() });
const strike = c.object({ id: c.string(), kind: c.string(), policy: c.string(), reason: c.string(), source: c.string(), issuedAt: c.string(), expiresAt: c.nullable(c.string()), status: c.string(), appealStatus: c.string(), canAppeal: c.boolean(), claimId: c.nullable(c.string()) });
const accountStatus = c.object({
  status: c.string(["GOOD_STANDING", "AT_RISK", "RESTRICTED"]), restrictions: c.array(c.string()), canMonetise: c.boolean(), canGoLive: c.boolean(), activeStrikeCount: c.number(), restrictionThreshold: c.number(),
  pendingTakedownCount: c.number(), strikeLifetimeDays: c.number(), warnings: c.array(strike), strikes: c.array(strike), notices: c.array(c.object({ claimId: c.string(), state: c.string(), deadlineAt: c.nullable(c.string()) })),
});

const creatorAnalyticsSummary = c.object({
  creatorId: c.string(),
  window: c.string(),
  views: c.number(),
  engagements: c.number(),
  profileVisits: c.number(),
  revenueMinor: c.number(),
});

const ingressHealth = c.object({
  protocol: c.string(["rtmp", "whip"]), status: c.string(["inactive", "buffering", "publishing", "error", "complete", "unknown"]), error: c.nullable(c.string()),
  videoBitrateKbps: c.nullable(c.number()), audioBitrateKbps: c.nullable(c.number()), width: c.nullable(c.number()), height: c.nullable(c.number()), framerate: c.nullable(c.number()),
});
const streamHealth = c.object({ liveId: c.string(), state: liveState, viewers: c.number(), peakViewers: c.number(), startedAt: c.nullable(c.string()), ingress: c.nullable(ingressHealth), checkedAt: c.string() });
const scheduledLive = c.object({ id: c.string(), title: c.string(), category: c.string(), state: liveState, startedAt: c.nullable(c.string()), endedAt: c.nullable(c.string()), storeId: c.nullable(c.string()), scheduledAt: c.nullable(c.string()) });
const commentAudience = c.string(["everyone", "followers", "subscribers"]);
const roomSettings = c.object({ liveId: c.string(), commentsEnabled: c.boolean(), commentAudience, slowModeSeconds: c.number(), blockedWords: c.array(c.string()), myRole: c.string() });
const hostDefaults = c.object({ commentsEnabled: c.boolean(), commentAudience, slowModeSeconds: c.number(), blockedWords: c.array(c.string()), moderators: c.array(person), updatedAt: c.nullable(c.string()) });
const recording = c.object({ id: c.string(), liveId: c.string(), state: c.string(["recording", "completed", "failed"]), durationSeconds: c.number(), sizeBytes: c.number(), createdAt: c.string(), completedAt: c.nullable(c.string()), playbackUrl: c.nullable(c.string()) });
const postComment = c.object({ id: c.string(), postId: c.string(), parentCommentId: c.nullable(c.string()), author: person, text: c.string(), createdAt: c.string(), likes: c.number(), replyCount: c.number(), isPinned: c.boolean(), isPostAuthor: c.boolean() });
const myPostComment = c.object({
  id: c.string(), postId: c.string(), parentCommentId: c.nullable(c.string()), author: person, text: c.string(), createdAt: c.string(), likes: c.number(), replyCount: c.number(), isPinned: c.boolean(), isPostAuthor: c.boolean(),
  previewReplies: c.array(postComment), post: c.object({ id: c.string(), kind: c.string(), text: c.string(), thumbnailUrl: c.nullable(c.string()) }), hidden: c.boolean(), hiddenAt: c.nullable(c.string()), needsReply: c.boolean(),
});
const commentHiddenState = c.object({ commentId: c.string(), postId: c.string(), hidden: c.boolean(), hiddenAt: c.nullable(c.string()) });
const notificationPreference = c.object({ category: c.string(), push: c.boolean(), email: c.boolean(), locked: c.boolean() });
const noContent = c.any();
const inTwoHours = new Date(Date.now() + 2 * 3_600_000).toISOString();

const affiliateStore = c.object({ id: c.string(), name: c.string(), logoUrl: c.nullable(c.string()) });
const affiliateAccess = c.string(["approved", "paused", "requested", "open", "approval_required", "closed"]);
const programmeTerms = c.object({ defaultCommissionPercent: c.number(), attributionWindowDays: c.number(), approval: c.string(["automatic", "manual"]), autoApproveFollowersAbove: c.nullable(c.number()), commissionPaidWhen: c.string(["order_completed"]) });
const affiliateLink = c.object({ id: c.string(), productId: c.string(), storeId: c.string(), path: c.string(), clicks: c.number(), createdAt: c.string() });
const promotableProduct = c.object({
  productId: c.string(), name: c.string(), imageUrl: c.nullable(c.string()), price: money, stock: c.nullable(c.number()), store: affiliateStore, commissionBasisPoints: c.number(), commissionPercent: c.number(),
  estimatedCommission: money, access: affiliateAccess, link: c.nullable(affiliateLink), programme: programmeTerms,
});
const affiliatePromotion = c.object({
  productId: c.string(), name: c.string(), imageUrl: c.nullable(c.string()), price: money, stock: c.nullable(c.number()), store: affiliateStore, commissionPercent: c.number(), access: affiliateAccess,
  link: c.nullable(affiliateLink), clicks: c.number(), pendingOrders: c.number(), completedOrders: c.number(), reversedOrders: c.number(), conversionPercent: c.nullable(c.number()), sales: money, earned: money,
  pendingEarnings: money, programme: c.nullable(programmeTerms),
});
const affiliateEarning = c.object({
  id: c.string(), status: c.string(["pending", "earned", "reversed"]), payoutStatus: c.string(["awaiting_completion", "waiting_for_seller_funds", "transferring", "paid", "reversed", "not_paid"]), reason: c.string(),
  orderNumber: c.string(), product: c.object({ id: c.string(), name: c.string() }), store: c.object({ id: c.string(), name: c.string() }), sale: money, commissionPercent: c.number(), commission: money, reversed: money,
  source: c.object({ source: c.string(), id: c.string() }), orderedAt: c.nullable(c.string()), decidedAt: c.nullable(c.string()), createdAt: c.string(),
});
const affiliateEarningsPage = c.object({ summary: c.object({ pending: c.array(money), earned: c.array(money), paid: c.array(money), reversed: c.array(money) }), data: c.array(affiliateEarning), nextCursor: c.nullable(c.string()) });

export const studioContracts: readonly EndpointContract[] = [
  { domain: "auth", method: "POST", path: "/api/v1/auth/login", body: { identifier: "creator@nantty.com", password: "x" }, schema: session },
  { domain: "auth", method: "POST", path: "/api/v1/auth/google", body: { idToken: "a.b.c", nonce: "raw" }, schema: session },
  { domain: "auth", method: "POST", path: "/api/v1/auth/apple", body: { identityToken: "a.b.c", nonce: "raw" }, schema: session },
  { domain: "auth", method: "GET", path: "/api/v1/users/me", schema: user },
  { domain: "live", method: "GET", path: "/api/v1/lives", schema: c.page(studioLive) },
  { domain: "live", method: "GET", path: "/api/v1/lives/live_1", schema: liveSession },
  { domain: "live", method: "POST", path: "/api/v1/lives", body: { title: "Contract live", category: "music", startNow: false }, schema: liveSession },
  { domain: "live", method: "POST", path: "/api/v1/lives", body: { title: "Store live", category: "shopping", startNow: false, storeId: "store_1", productIds: ["prod_1"] }, schema: liveSession },
  { domain: "live", method: "GET", path: "/api/v1/lives/live_1/stream-key", schema: streamKey },
  { domain: "live", method: "POST", path: "/api/v1/lives/live_1/stream-key", schema: streamKey },
  { domain: "live", method: "GET", path: "/api/v1/creators/me/analytics/gifts/streams/live_1", schema: streamStats },
  { domain: "live", method: "GET", path: "/api/v1/lives/live_1/comments", schema: c.page(liveComment) },
  { domain: "live", method: "GET", path: "/api/v1/lives/live_1/products", schema: c.page(productPin) },
  { domain: "live", method: "POST", path: "/api/v1/lives/live_1/pins", body: { productId: "prod_1" }, schema: c.page(productPin) },
  { domain: "live", method: "GET", path: "/api/v1/lives/live_1/overlays", schema: overlayScene },
  { domain: "live", method: "GET", path: "/api/v1/overlay-scenes/scene_live_1", schema: c.object({ scene: overlayScene, live: c.object({ id: c.string(), title: c.string(), state: liveState }) }) },
  { domain: "catalog", method: "GET", path: "/api/v1/seller/stores/mine", schema: c.page(myStore) },
  { domain: "catalog", method: "GET", path: "/api/v1/seller/products?status=active&limit=100", schema: c.page(sellerProduct) },
  { domain: "payments", method: "GET", path: "/api/v1/banks?country=NG", schema: c.page(bank) },
  { domain: "payments", method: "GET", path: "/api/v1/payments/payout-onboarding/me", schema: payoutState },
  { domain: "payments", method: "GET", path: "/api/v1/wallets/me", schema: walletSummary },
  { domain: "payments", method: "GET", path: "/api/v1/wallets/me/withdrawals", schema: c.page(withdrawal) },
  { domain: "creators", method: "GET", path: "/api/v1/creators/me", schema: creatorStatus },
  { domain: "creators", method: "GET", path: "/api/v1/creators/dashboard?period=week", schema: dashboard },
  { domain: "analytics", method: "GET", path: "/api/v1/analytics/creator/summary?window=30d", schema: creatorAnalyticsSummary },
  { domain: "creators", method: "GET", path: "/api/v1/creators/revenue-rules", schema: revenueRules },
  { domain: "creators", method: "GET", path: "/api/v1/creators/earnings", schema: c.page(earning) },
  { domain: "creators", method: "GET", path: "/api/v1/creators/eligibility", schema: eligibility },
  { domain: "creators", method: "GET", path: "/api/v1/creators/brand-deals", schema: c.page(brandDeal) },
  { domain: "creators", method: "GET", path: "/api/v1/creators/me/affiliate-catalog?sort=commission&limit=24", schema: c.page(promotableProduct) },
  { domain: "creators", method: "GET", path: "/api/v1/creators/me/affiliate-catalog?access=requestable&q=scarf", schema: c.page(promotableProduct) },
  { domain: "creators", method: "GET", path: "/api/v1/creators/me/affiliate-promotions", schema: c.page(affiliatePromotion) },
  { domain: "creators", method: "GET", path: "/api/v1/creators/me/affiliate-earnings?status=pending", schema: affiliateEarningsPage },
  { domain: "creators", method: "GET", path: "/api/v1/creators/me/affiliate-earnings?status=earned", schema: affiliateEarningsPage },
  { domain: "creators", method: "GET", path: "/api/v1/creators/me/affiliate-earnings?status=reversed", schema: affiliateEarningsPage },
  { domain: "creators", method: "POST", path: "/api/v1/creators/me/affiliate-links", body: { productId: "prod_dress" }, schema: affiliateLink },
  { domain: "creators", method: "POST", path: "/api/v1/creators/affiliations", body: { productId: "prod_scarf" }, schema: c.object({ id: c.string(), status: c.string(["active", "requested", "declined"]) }) },
  { domain: "creators", method: "POST", path: "/api/v1/creators/brand-deals", body: { brandName: "Acme", amountMinor: 100, currency: "NGN", startsAt: "2026-10-01T00:00:00Z", endsAt: null, disclosure: "Paid partnership with Acme", notes: "" }, schema: brandDeal },
  { domain: "subscriptions", method: "GET", path: "/api/v1/creators/me/subscription-plans", schema: c.page(plan) },
  { domain: "subscriptions", method: "GET", path: "/api/v1/creators/me/subscription-plans/price-tiers?currency=NGN&interval=month", schema: c.page(priceTier) },
  { domain: "subscriptions", method: "GET", path: "/api/v1/creators/me/subscribers", schema: c.page(subscriber) },
  { domain: "social", method: "GET", path: "/api/v1/users/u_me/posts?kind=clip", schema: c.page(myPost) },
  { domain: "social", method: "GET", path: "/api/v1/posts/post_clip_1/analytics", schema: postAnalytics },
  { domain: "social", method: "GET", path: "/api/v1/users/me/followers", schema: c.page(follower) },
  { domain: "live", method: "GET", path: "/api/v1/rankings?board=streamer&period=week", schema: c.page(ranking) },
  { domain: "trust", method: "GET", path: "/api/v1/account/status", schema: accountStatus },
  { domain: "live", method: "GET", path: "/api/v1/lives/live_1/stream-health", schema: streamHealth },
  { domain: "live", method: "POST", path: "/api/v1/lives", body: { title: "Scheduled live", category: "music", startNow: false, scheduledAt: inTwoHours }, schema: scheduledLive },
  { domain: "live", method: "PATCH", path: "/api/v1/lives/live_4", body: { title: "Friday glaze reveal", scheduledAt: inTwoHours }, schema: scheduledLive },
  { domain: "live", method: "POST", path: "/api/v1/lives/live_3/cancel", schema: noContent },
  { domain: "live", method: "GET", path: "/api/v1/lives/live_2/recordings", schema: c.page(recording) },
  { domain: "live", method: "DELETE", path: "/api/v1/lives/live_2/recordings/rec_2b", schema: noContent },
  { domain: "live", method: "GET", path: "/api/v1/lives/live_1/room-settings", schema: roomSettings },
  { domain: "live", method: "PUT", path: "/api/v1/lives/live_1/room-settings", body: { commentsEnabled: true, commentAudience: "followers", slowModeSeconds: 5, blockedWords: ["scam", "🍑"] }, schema: roomSettings },
  { domain: "live", method: "GET", path: "/api/v1/live/host-defaults", schema: hostDefaults },
  { domain: "live", method: "PUT", path: "/api/v1/live/host-defaults", body: { commentsEnabled: true, commentAudience: "everyone", slowModeSeconds: 0, blockedWords: ["🍑"], moderatorIds: ["f_1"] }, schema: hostDefaults },
  { domain: "social", method: "GET", path: "/api/v1/me/post-comments?filter=all&limit=20", schema: c.page(myPostComment) },
  { domain: "social", method: "GET", path: "/api/v1/me/post-comments?filter=needs_reply&postId=post_2", schema: c.page(myPostComment) },
  { domain: "social", method: "POST", path: "/api/v1/posts/post_2/comments", body: { text: "Yes, we ship to Abuja.", parentCommentId: "cm_4" }, schema: postComment },
  { domain: "social", method: "PUT", path: "/api/v1/posts/post_2/comments/cm_4/pin", schema: postComment },
  { domain: "social", method: "DELETE", path: "/api/v1/posts/post_2/comments/cm_4/pin", schema: noContent },
  { domain: "social", method: "PUT", path: "/api/v1/posts/post_2/comments/cm_4/hide", schema: commentHiddenState },
  { domain: "social", method: "GET", path: "/api/v1/me/post-comments?filter=hidden", schema: c.page(myPostComment) },
  { domain: "social", method: "DELETE", path: "/api/v1/posts/post_2/comments/cm_4/hide", schema: commentHiddenState },
  { domain: "social", method: "DELETE", path: "/api/v1/comments/cm_1", schema: noContent },
  { domain: "notifications", method: "GET", path: "/api/v1/notifications/unread-count", schema: c.object({ count: c.number() }) },
  { domain: "notifications", method: "GET", path: "/api/v1/notifications/preferences", schema: c.page(notificationPreference) },
  { domain: "notifications", method: "PATCH", path: "/api/v1/notifications/preferences", body: { category: "live", push: false }, schema: notificationPreference },
  { domain: "users", method: "GET", path: "/api/v1/users/me/mention-privacy", schema: c.object({ whoCanMentionMe: c.string(["everyone", "following", "no_one"]) }) },
  { domain: "users", method: "PUT", path: "/api/v1/users/me/mention-privacy", body: { whoCanMentionMe: "following" }, schema: c.object({ whoCanMentionMe: c.string(["everyone", "following", "no_one"]) }) },
  { domain: "users", method: "GET", path: "/api/v1/users/me/message-privacy", schema: c.object({ whoCanMessageMe: c.string(["everyone", "following", "followers", "nobody"]) }) },
  { domain: "users", method: "PUT", path: "/api/v1/users/me/message-privacy", body: { whoCanMessageMe: "followers" }, schema: c.object({ whoCanMessageMe: c.string(["everyone", "following", "followers", "nobody"]) }) },
];
