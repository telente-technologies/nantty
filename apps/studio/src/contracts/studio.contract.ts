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
const liveSession = c.object({ id: c.string(), title: c.string(), category: c.string(), state: liveState, viewers: c.number(), peakViewers: c.number(), startedAt: c.nullable(c.string()), endedAt: c.nullable(c.string()), playbackUrl: c.nullable(c.string()) });
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

export const studioContracts: readonly EndpointContract[] = [
  { domain: "auth", method: "POST", path: "/api/v1/auth/login", body: { identifier: "creator@zudomart.com", password: "x" }, schema: session },
  { domain: "auth", method: "POST", path: "/api/v1/auth/google", body: { idToken: "a.b.c", nonce: "raw" }, schema: session },
  { domain: "auth", method: "POST", path: "/api/v1/auth/apple", body: { identityToken: "a.b.c", nonce: "raw" }, schema: session },
  { domain: "auth", method: "GET", path: "/api/v1/users/me", schema: user },
  { domain: "live", method: "GET", path: "/api/v1/lives", schema: c.page(studioLive) },
  { domain: "live", method: "GET", path: "/api/v1/lives/live_1", schema: liveSession },
  { domain: "live", method: "POST", path: "/api/v1/lives", body: { title: "Contract live", category: "music", startNow: false }, schema: liveSession },
  { domain: "live", method: "GET", path: "/api/v1/lives/live_1/stream-key", schema: streamKey },
  { domain: "live", method: "POST", path: "/api/v1/lives/live_1/stream-key", schema: streamKey },
  { domain: "live", method: "GET", path: "/api/v1/creators/me/analytics/gifts/streams/live_1", schema: streamStats },
  { domain: "live", method: "GET", path: "/api/v1/lives/live_1/comments", schema: c.page(liveComment) },
  { domain: "live", method: "GET", path: "/api/v1/lives/live_1/products", schema: c.page(productPin) },
  { domain: "live", method: "POST", path: "/api/v1/lives/live_1/pins", body: { productId: "prod_1" }, schema: c.page(productPin) },
  { domain: "live", method: "GET", path: "/api/v1/lives/live_1/overlays", schema: overlayScene },
  { domain: "live", method: "GET", path: "/api/v1/overlay-scenes/scene_live_1", schema: c.object({ scene: overlayScene, live: c.object({ id: c.string(), title: c.string(), state: liveState }) }) },
  { domain: "catalog", method: "GET", path: "/api/v1/seller/products?status=active&limit=100", schema: c.page(sellerProduct) },
  { domain: "payments", method: "GET", path: "/api/v1/banks?country=NG", schema: c.page(bank) },
  { domain: "payments", method: "GET", path: "/api/v1/payments/payout-onboarding/me", schema: payoutState },
];
