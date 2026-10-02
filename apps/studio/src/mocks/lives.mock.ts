import { ApiError } from "@/errors/api.error";
import type { ID, ISODate, LiveComment, LiveProduct, LiveSession, OverlayLayer, OverlayScene } from "@/types";

import { createMockRoute, type MockRoute } from "./registry.mock";

const hoursAgo = (hours: number): ISODate => new Date(Date.now() - hours * 3_600_000).toISOString();
const minutesAgo = (minutes: number): ISODate => new Date(Date.now() - minutes * 60_000).toISOString();

const readIngestUrl = () => process.env.RTMP_INGEST_URL ?? "rtmp://studio.zudomart.com/live";
const readHlsBaseUrl = () => process.env.HLS_PLAYBACK_URL ?? "https://studio.zudomart.com/hls";

const buildStreamKey = (liveId: ID) => `sk_${liveId}_${btoa(liveId).replace(/=/g, "").slice(0, 16)}`;

const buildHlsUrl = (liveId: ID) => `${readHlsBaseUrl()}/${liveId}/index.m3u8`;

const CATALOG_PRODUCTS: readonly LiveProduct[] = [
  { id: "prod_1", title: "Handwoven Adire Wrap Dress", priceLabel: "₦42,000", imageUrl: null, pinned: false },
  { id: "prod_2", title: "Clay Pot with Lid — Medium", priceLabel: "₦18,500", imageUrl: null, pinned: false },
  { id: "prod_3", title: "Raffia Placemat Set of 4", priceLabel: "₦12,000", imageUrl: null, pinned: false },
  { id: "prod_4", title: "Shea & Black Soap Bar Duo", priceLabel: "₦9,750", imageUrl: null, pinned: false },
];

const DEFAULT_LAYERS: readonly OverlayLayer[] = [
  { id: "layer_lower_third", type: "text", name: "Lower third", x: 64, y: 900, width: 720, height: 96, zIndex: 10, opacity: 0.95, text: "Temitope Adeyemi", fontSize: 44, color: "#ffffff", background: "#0b1752", radius: 8 },
  { id: "layer_logo_badge", type: "shape", name: "Logo plate", x: 1690, y: 48, width: 180, height: 180, zIndex: 20, opacity: 0.9, background: "#2043f5", radius: 90 },
];

const buildScene = (liveId: ID): OverlayScene => ({
  id: `scene_${liveId}`,
  liveId,
  name: "Main scene",
  layers: [...DEFAULT_LAYERS],
});

const liveState = new Map<ID, LiveSession>();
const overlayState = new Map<ID, OverlayScene>();
const commentState = new Map<ID, LiveComment[]>();

const seedLive = (live: LiveSession) => {
  liveState.set(live.id, live);
  overlayState.set(live.id, buildScene(live.id));
  commentState.set(live.id, [...live.comments]);
};

seedLive({
  id: "live_1",
  title: "Sunday pots restock — live from Ibadan",
  state: "live",
  createdAt: hoursAgo(2),
  startedAt: minutesAgo(38),
  endedAt: null,
  viewers: 1284,
  peakViewers: 2140,
  streamKey: buildStreamKey("live_1"),
  ingestUrl: readIngestUrl(),
  hlsUrl: buildHlsUrl("live_1"),
  products: [{ ...CATALOG_PRODUCTS[1]!, pinned: true }, CATALOG_PRODUCTS[2]!],
  comments: [
    { id: "c_1", authorName: "Kemi", text: "Is the medium pot still in stock?", createdAt: minutesAgo(6) },
    { id: "c_2", authorName: "Chidi", text: "Just ordered, escrow is a lifesaver", createdAt: minutesAgo(3) },
  ],
});

seedLive({
  id: "live_2",
  title: "Adire drop — December Owambe Edit",
  state: "ended",
  createdAt: hoursAgo(52),
  startedAt: hoursAgo(51),
  endedAt: hoursAgo(50),
  viewers: 4310,
  peakViewers: 6120,
  streamKey: buildStreamKey("live_2"),
  ingestUrl: readIngestUrl(),
  hlsUrl: buildHlsUrl("live_2"),
  products: [CATALOG_PRODUCTS[0]!],
  comments: [{ id: "c_3", authorName: "Bola", text: "That gold gele is everything", createdAt: hoursAgo(50) }],
});

seedLive({
  id: "live_3",
  title: "Harmattan skincare live",
  state: "idle",
  createdAt: minutesAgo(4),
  startedAt: null,
  endedAt: null,
  viewers: 0,
  peakViewers: 0,
  streamKey: buildStreamKey("live_3"),
  ingestUrl: readIngestUrl(),
  hlsUrl: null,
  products: [CATALOG_PRODUCTS[3]!],
  comments: [],
});

const findLiveOrThrow = (liveId: string): LiveSession => {
  const live = liveState.get(liveId);
  if (!live) throw new ApiError(404, "That live session no longer exists.", "LIVE_NOT_FOUND");
  return live;
};

const patchLive = (liveId: ID, change: (live: LiveSession) => LiveSession): LiveSession => {
  const updated = change(findLiveOrThrow(liveId));
  liveState.set(liveId, updated);
  return updated;
};

export const liveMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/lives", () =>
    [...liveState.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  ),
  createMockRoute("GET", "/api/v1/lives/:liveId", ({ params }) => findLiveOrThrow(params.liveId!)),
  createMockRoute("POST", "/api/v1/lives", ({ body }) => {
    const title = String((body as { title?: unknown } | null)?.title ?? "").trim() || "Untitled live";
    const id = `live_${liveState.size + 1}_${Date.now()}`;
    const live: LiveSession = {
      id,
      title,
      state: "idle",
      createdAt: new Date().toISOString(),
      startedAt: null,
      endedAt: null,
      viewers: 0,
      peakViewers: 0,
      streamKey: buildStreamKey(id),
      ingestUrl: readIngestUrl(),
      hlsUrl: null,
      products: [],
      comments: [],
    };
    seedLive(live);
    return live;
  }),
  createMockRoute("POST", "/api/v1/lives/:liveId/start", ({ params }) => {
    const liveId = params.liveId!;
    return patchLive(liveId, (live) => ({ ...live, state: "live", startedAt: live.startedAt ?? new Date().toISOString(), endedAt: null, hlsUrl: buildHlsUrl(liveId), viewers: Math.max(live.viewers, 1) }));
  }),
  createMockRoute("POST", "/api/v1/lives/:liveId/end", ({ params }) =>
    patchLive(params.liveId!, (live) => ({ ...live, state: "ended", endedAt: new Date().toISOString(), viewers: 0 })),
  ),
  createMockRoute("POST", "/api/v1/lives/:liveId/stream-key", ({ params }) => {
    const liveId = params.liveId!;
    return patchLive(liveId, (live) => ({ ...live, streamKey: buildStreamKey(`${liveId}_${Date.now()}`) }));
  }),
  createMockRoute("GET", "/api/v1/lives/:liveId/overlays", ({ params }) => {
    const liveId = params.liveId!;
    const scene = overlayState.get(liveId) ?? buildScene(liveId);
    overlayState.set(liveId, scene);
    return scene;
  }),
  createMockRoute("PUT", "/api/v1/lives/:liveId/overlays", ({ params, body }) => {
    const liveId = params.liveId!;
    const payload = (body ?? {}) as { name?: unknown; layers?: unknown };
    const scene: OverlayScene = {
      id: `scene_${liveId}`,
      liveId,
      name: typeof payload.name === "string" && payload.name.trim() ? payload.name : "Main scene",
      layers: Array.isArray(payload.layers) ? (payload.layers as OverlayLayer[]) : [],
    };
    overlayState.set(liveId, scene);
    return scene;
  }),
  createMockRoute("GET", "/api/v1/lives/:liveId/comments", ({ params }) => commentState.get(params.liveId!) ?? []),
  createMockRoute("POST", "/api/v1/lives/:liveId/comments", ({ params, body }) => {
    const liveId = params.liveId!;
    const text = String((body as { text?: unknown } | null)?.text ?? "").trim();
    if (!text) throw new ApiError(400, "Write a comment first.", "VALIDATION_FAILED");
    const comment: LiveComment = { id: `c_${Date.now()}`, authorName: "You", text, createdAt: new Date().toISOString() };
    const next = [comment, ...(commentState.get(liveId) ?? [])];
    commentState.set(liveId, next);
    return comment;
  }),
  createMockRoute("GET", "/api/v1/lives/:liveId/products", ({ params }) => findLiveOrThrow(params.liveId!).products),
  createMockRoute("POST", "/api/v1/lives/:liveId/products", ({ params, body }) => {
    const liveId = params.liveId!;
    const productId = String((body as { productId?: unknown } | null)?.productId ?? "");
    const product = CATALOG_PRODUCTS.find((candidate) => candidate.id === productId);
    if (!product) throw new ApiError(404, "That product is not available.", "PRODUCT_NOT_FOUND");
    return patchLive(liveId, (live) => ({
      ...live,
      products: live.products.some((candidate) => candidate.id === product.id) ? live.products : [...live.products, product],
    }));
  }),
  createMockRoute("GET", "/api/v1/live-products", () => CATALOG_PRODUCTS),
  createMockRoute("GET", "/api/v1/overlay-scenes/:sceneId", ({ params }) => {
    const sceneId = params.sceneId!;
    const liveId = sceneId.startsWith("scene_") ? sceneId.slice("scene_".length) : sceneId;
    const live = liveState.get(liveId);
    if (!live) throw new ApiError(404, "That overlay scene no longer exists.", "SCENE_NOT_FOUND");
    return { scene: overlayState.get(liveId) ?? buildScene(liveId), live: { id: live.id, title: live.title, state: live.state } };
  }),
];
