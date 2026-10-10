import { ApiError } from "@/errors/api.error";
import type { ID, ISODate, LiveCategory, LiveComment, LiveCommentWire, LiveProductPinWire, LiveSessionWire, LiveState, OverlayLayer, OverlayScene, SellerProductWire, StreamKeyWire, StreamStatsWire, StudioLiveWire } from "@/types";

import { createMockRoute, type MockRoute } from "./registry.mock";

const hoursAgo = (hours: number): ISODate => new Date(Date.now() - hours * 3_600_000).toISOString();
const minutesAgo = (minutes: number): ISODate => new Date(Date.now() - minutes * 60_000).toISOString();

const readIngestUrl = () => process.env.RTMP_INGEST_URL ?? "rtmp://studio.zudomart.com/live";
const readHlsBaseUrl = () => process.env.HLS_PLAYBACK_URL ?? "https://studio.zudomart.com/hls";

const buildStreamKey = (liveId: ID) => `sk_${liveId}_${btoa(liveId).replace(/=/g, "").slice(0, 16)}`;

const buildHlsUrl = (liveId: ID) => `${readHlsBaseUrl()}/${liveId}/index.m3u8`;

const SELLER_PRODUCTS: readonly SellerProductWire[] = [
  { id: "prod_1", name: "Handwoven Adire Wrap Dress", status: "active", images: [], variants: [{ price: { amountMinor: 4200000, currency: "NGN" } }] },
  { id: "prod_2", name: "Clay Pot with Lid — Medium", status: "active", images: [], variants: [{ price: { amountMinor: 1850000, currency: "NGN" } }] },
  { id: "prod_3", name: "Raffia Placemat Set of 4", status: "active", images: [], variants: [{ price: { amountMinor: 1200000, currency: "NGN" } }] },
  { id: "prod_4", name: "Shea & Black Soap Bar Duo", status: "active", images: [], variants: [{ price: { amountMinor: 975000, currency: "NGN" } }] },
];

const MY_STORES = [{ storeId: "store_1", storeName: "Temi's Pottery", role: "owner", isCurrent: true }] as const;

const LIVE_CATEGORY_VALUES: readonly LiveCategory[] = ["justChatting", "gaming", "music", "irl", "education", "shopping"];

const DEFAULT_LAYERS: readonly OverlayLayer[] = [
  { id: "layer_lower_third", type: "text", name: "Lower third", x: 64, y: 900, width: 720, height: 96, zIndex: 10, opacity: 0.95, text: "Temitope Adeyemi", fontSize: 44, color: "#ffffff", background: "#181263", radius: 8 },
  { id: "layer_logo_badge", type: "shape", name: "Logo plate", x: 1690, y: 48, width: 180, height: 180, zIndex: 20, opacity: 0.9, background: "#3a2bff", radius: 90 },
];

interface MockLive {
  readonly id: ID;
  readonly title: string;
  readonly category: LiveCategory;
  readonly state: LiveState;
  readonly createdAt: ISODate;
  readonly startedAt: ISODate | null;
  readonly endedAt: ISODate | null;
  readonly viewers: number;
  readonly peakViewers: number;
  readonly coins: number;
  readonly giftCount: number;
  readonly topSupporters: readonly { readonly id: ID; readonly name: string; readonly coins: number }[];
  readonly streamKey: string | null;
  readonly pins: readonly LiveProductPinWire[];
  readonly storeId: ID | null;
}

const buildScene = (liveId: ID): OverlayScene => ({ id: `scene_${liveId}`, liveId, name: "Main scene", layers: [...DEFAULT_LAYERS] });

const toCommentWire = (comment: LiveComment): LiveCommentWire => ({
  id: comment.id,
  author: { id: `u_${comment.authorName.toLowerCase()}`, name: comment.authorName, username: comment.authorName.toLowerCase(), avatarUrl: null },
  text: comment.text,
  createdAt: comment.createdAt,
});

const hlsUrlFor = (live: MockLive) => (live.state === "idle" ? null : buildHlsUrl(live.id));

const toStudioLiveWire = (live: MockLive): StudioLiveWire => ({
  id: live.id, title: live.title, category: live.category, state: live.state, createdAt: live.createdAt, startedAt: live.startedAt, endedAt: live.endedAt,
  viewers: live.viewers, peakViewers: live.peakViewers, streamKeyHint: live.streamKey ? live.streamKey.slice(-4) : null, ingestProtocol: live.streamKey ? "rtmp" : null,
  hlsUrl: hlsUrlFor(live), earnings: { coins: live.coins, giftCount: live.giftCount }, recordEnabled: false, visibility: "public", products: live.pins,
});

const toLiveSessionWire = (live: MockLive): LiveSessionWire => ({
  id: live.id, title: live.title, category: live.category, state: live.state, viewers: live.viewers, peakViewers: live.peakViewers,
  startedAt: live.startedAt, endedAt: live.endedAt, playbackUrl: hlsUrlFor(live), storeId: live.storeId,
});

const toStreamKeyWire = (live: MockLive, streamKey: string): StreamKeyWire => ({
  liveId: live.id, protocol: "rtmp", ingestUrl: readIngestUrl(), streamKey, streamKeyHint: streamKey.slice(-4), issuedAt: new Date().toISOString(),
});

const liveState = new Map<ID, MockLive>();
const overlayState = new Map<ID, OverlayScene>();
const commentState = new Map<ID, LiveComment[]>();

const seedLive = (live: MockLive, comments: LiveComment[] = []) => {
  liveState.set(live.id, live);
  overlayState.set(live.id, buildScene(live.id));
  commentState.set(live.id, comments);
};

seedLive(
  {
    id: "live_1", title: "Sunday pots restock — live from Ibadan", category: "shopping", state: "live", createdAt: hoursAgo(2), startedAt: minutesAgo(38), endedAt: null,
    viewers: 1284, peakViewers: 2140, coins: 18400, giftCount: 212,
    topSupporters: [{ id: "g_1", name: "Kemi", coins: 4200 }, { id: "g_2", name: "Chidi", coins: 3100 }, { id: "g_3", name: "Bola", coins: 1750 }],
    streamKey: buildStreamKey("live_1"), pins: [{ productId: "prod_3", pinned: false }, { productId: "prod_2", pinned: true }], storeId: "store_1",
  },
  [
    { id: "c_1", authorName: "Kemi", text: "Is the medium pot still in stock?", createdAt: minutesAgo(6) },
    { id: "c_2", authorName: "Chidi", text: "Just ordered, escrow is a lifesaver", createdAt: minutesAgo(3) },
  ],
);

seedLive(
  {
    id: "live_2", title: "Late night beats and freestyle with guests", category: "music", state: "ended", createdAt: hoursAgo(52), startedAt: hoursAgo(51), endedAt: hoursAgo(50),
    viewers: 0, peakViewers: 6120, coins: 52300, giftCount: 640,
    topSupporters: [{ id: "g_4", name: "Tobi", coins: 9800 }, { id: "g_5", name: "Amaka", coins: 7400 }, { id: "g_6", name: "Sade", coins: 5200 }],
    streamKey: null, pins: [], storeId: null,
  },
  [{ id: "c_3", authorName: "Bola", text: "That gold gele is everything", createdAt: hoursAgo(50) }],
);

seedLive({
  id: "live_3", title: "Ranked grind: Rocket League with chat", category: "gaming", state: "idle", createdAt: minutesAgo(4), startedAt: null, endedAt: null,
  viewers: 0, peakViewers: 0, coins: 0, giftCount: 0, topSupporters: [], streamKey: buildStreamKey("live_3"), pins: [], storeId: null,
});

const findLiveOrThrow = (liveId: string): MockLive => {
  const live = liveState.get(liveId);
  if (!live) throw new ApiError(404, "That live session no longer exists.", "LIVE_NOT_FOUND");
  return live;
};

const patchLive = (liveId: ID, change: (live: MockLive) => MockLive): MockLive => {
  const updated = change(findLiveOrThrow(liveId));
  liveState.set(liveId, updated);
  return updated;
};

const toStreamStatsWire = (live: MockLive): StreamStatsWire => ({
  liveId: live.id, giftCount: live.giftCount, totalCoins: live.coins * 2, creatorCoins: live.coins,
  topSupporters: live.topSupporters.map((supporter, index) => ({ rank: index + 1, user: { id: supporter.id, name: supporter.name, username: supporter.name.toLowerCase() }, coins: supporter.coins })),
});

export const liveMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/lives", () => ({
    data: [...liveState.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(toStudioLiveWire),
    nextCursor: null,
  })),
  createMockRoute("GET", "/api/v1/lives/:liveId", ({ params }) => toLiveSessionWire(findLiveOrThrow(params.liveId!))),
  createMockRoute("POST", "/api/v1/lives", ({ body }) => {
    const payload = (body ?? {}) as { title?: unknown; category?: unknown; startNow?: unknown; storeId?: unknown; productIds?: unknown };
    const title = String(payload.title ?? "").trim();
    if (!title || title.length > 140) throw new ApiError(400, "title must be 1-140 characters", "VALIDATION_FAILED");
    if (!LIVE_CATEGORY_VALUES.includes(payload.category as LiveCategory)) throw new ApiError(400, "category is not supported", "VALIDATION_FAILED");
    const storeId = typeof payload.storeId === "string" && payload.storeId ? payload.storeId : null;
    const productIds = Array.isArray(payload.productIds) ? (payload.productIds as string[]) : [];
    if (productIds.length > 0 && !storeId) throw new ApiError(422, "Start the live for a store to show products.", "PRODUCTS_REQUIRE_STORE");
    if (storeId && !MY_STORES.some((store) => store.storeId === storeId)) throw new ApiError(403, "You are not a member of this store.", "NOT_STORE_MEMBER");
    if (productIds.some((productId) => !SELLER_PRODUCTS.some((product) => product.id === productId))) throw new ApiError(403, "That product is not in this store.", "PRODUCT_NOT_IN_STORE");
    const id = `live_${liveState.size + 1}_${Date.now()}`;
    const startNow = payload.startNow !== false;
    const live: MockLive = {
      id, title, category: payload.category as LiveCategory, state: startNow ? "live" : "idle", createdAt: new Date().toISOString(), startedAt: startNow ? new Date().toISOString() : null, endedAt: null,
      viewers: 0, peakViewers: 0, coins: 0, giftCount: 0, topSupporters: [], streamKey: null, pins: productIds.map((productId) => ({ productId, pinned: false })), storeId,
    };
    seedLive(live);
    return toLiveSessionWire(live);
  }),
  createMockRoute("POST", "/api/v1/lives/:liveId/start", ({ params }) =>
    toLiveSessionWire(patchLive(params.liveId!, (live) => ({ ...live, state: "live", startedAt: live.startedAt ?? new Date().toISOString(), endedAt: null, viewers: Math.max(live.viewers, 1) }))),
  ),
  createMockRoute("POST", "/api/v1/lives/:liveId/end", ({ params }) => {
    patchLive(params.liveId!, (live) => ({ ...live, state: "ended", endedAt: new Date().toISOString(), viewers: 0, streamKey: null }));
    return undefined;
  }),
  createMockRoute("GET", "/api/v1/lives/:liveId/stream-key", ({ params }) => {
    const live = findLiveOrThrow(params.liveId!);
    if (!live.streamKey) throw new ApiError(404, "There's no stream key for this live yet.", "STREAM_KEY_MISSING");
    return toStreamKeyWire(live, live.streamKey);
  }),
  createMockRoute("POST", "/api/v1/lives/:liveId/stream-key", ({ params }) => {
    const liveId = params.liveId!;
    if (findLiveOrThrow(liveId).state === "ended") throw new ApiError(409, "This live has ended.", "LIVE_NOT_ACTIVE");
    const live = patchLive(liveId, (current) => ({ ...current, streamKey: buildStreamKey(`${liveId}_${Date.now()}`) }));
    return toStreamKeyWire(live, live.streamKey!);
  }),
  createMockRoute("GET", "/api/v1/creators/me/analytics/gifts/streams/:liveId", ({ params }) => toStreamStatsWire(findLiveOrThrow(params.liveId!))),
  createMockRoute("GET", "/api/v1/lives/:liveId/overlays", ({ params }) => {
    const liveId = params.liveId!;
    const scene = overlayState.get(liveId) ?? buildScene(liveId);
    overlayState.set(liveId, scene);
    return scene;
  }),
  createMockRoute("PUT", "/api/v1/lives/:liveId/overlays", ({ params, body }) => {
    const liveId = params.liveId!;
    const payload = (body ?? {}) as { name?: unknown; layers?: unknown };
    const layers = Array.isArray(payload.layers) ? (payload.layers as OverlayLayer[]) : [];
    if (layers.some((layer) => layer.src !== undefined && !/^https:\/\/[^/]+/.test(layer.src))) throw new ApiError(400, "src must be an https image url", "VALIDATION_FAILED");
    const scene: OverlayScene = { id: `scene_${liveId}`, liveId, name: typeof payload.name === "string" && payload.name.trim() ? payload.name : "Main scene", layers };
    overlayState.set(liveId, scene);
    return scene;
  }),
  createMockRoute("GET", "/api/v1/lives/:liveId/comments", ({ params }) => ({ data: (commentState.get(params.liveId!) ?? []).map(toCommentWire), nextCursor: null })),
  createMockRoute("POST", "/api/v1/lives/:liveId/comments", ({ params, body }) => {
    const liveId = params.liveId!;
    const text = String((body as { text?: unknown } | null)?.text ?? "").trim();
    if (!text) throw new ApiError(400, "Write a comment first.", "VALIDATION_FAILED");
    const comment: LiveComment = { id: `c_${Date.now()}`, authorName: "You", text, createdAt: new Date().toISOString() };
    commentState.set(liveId, [comment, ...(commentState.get(liveId) ?? [])]);
    return toCommentWire(comment);
  }),
  createMockRoute("GET", "/api/v1/lives/:liveId/products", ({ params }) => ({ data: findLiveOrThrow(params.liveId!).pins, nextCursor: null })),
  createMockRoute("POST", "/api/v1/lives/:liveId/pins", ({ params, body }) => {
    const productId = String((body as { productId?: unknown } | null)?.productId ?? "");
    if (!findLiveOrThrow(params.liveId!).storeId) throw new ApiError(422, "Start the live for a store to show products.", "PRODUCTS_REQUIRE_STORE");
    const product = SELLER_PRODUCTS.find((candidate) => candidate.id === productId);
    if (!product) throw new ApiError(403, "That product is not in this store.", "PRODUCT_NOT_IN_STORE");
    if (product.status !== "active") throw new ApiError(422, "Publish the product before showing it on screen.", "PRODUCT_NOT_PUBLISHED");
    const live = patchLive(params.liveId!, (current) => ({
      ...current,
      pins: [...current.pins.filter((pin) => pin.productId !== productId).map((pin) => ({ ...pin, pinned: false })), { productId, pinned: true }],
    }));
    return { data: live.pins, nextCursor: null };
  }),
  createMockRoute("GET", "/api/v1/seller/stores/mine", () => ({ data: MY_STORES, nextCursor: null })),
  createMockRoute("GET", "/api/v1/seller/products", () => ({ data: SELLER_PRODUCTS, nextCursor: null })),
  createMockRoute("GET", "/api/v1/seller/products/:productId", ({ params }) => {
    const product = SELLER_PRODUCTS.find((candidate) => candidate.id === params.productId);
    if (!product) throw new ApiError(404, "That product is not available.", "PRODUCT_NOT_FOUND");
    return product;
  }),
  createMockRoute("GET", "/api/v1/overlay-scenes/:sceneId", ({ params }) => {
    const sceneId = params.sceneId!;
    const liveId = sceneId.startsWith("scene_") ? sceneId.slice("scene_".length) : sceneId;
    const live = liveState.get(liveId);
    if (!live) throw new ApiError(404, "That overlay scene no longer exists.", "SCENE_NOT_FOUND");
    return { scene: overlayState.get(liveId) ?? buildScene(liveId), live: { id: live.id, title: live.title, state: live.state } };
  }),
];
