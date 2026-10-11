import type {
  ID,
  LiveCategory,
  LiveComment,
  LiveCommentWire,
  LiveDetail,
  LiveEarnings,
  LiveProduct,
  LiveProductPinWire,
  LiveSession,
  LiveSessionWire,
  LiveState,
  MyStoreWire,
  OverlayLayer,
  OverlayScene,
  Page,
  SellerProductWire,
  StoreOption,
  StreamKey,
  StreamKeyWire,
  StreamStatsWire,
  StudioLiveWire,
} from "@/types";

import { isNotFoundError, sendRequestToStudioServer } from "./clientApi.service";

export interface CreateLiveInput {
  readonly title: string;
  readonly category: LiveCategory;
  readonly storeId: ID | null;
}

export interface OverlayScenePayload {
  readonly scene: OverlayScene;
  readonly live: { readonly id: ID; readonly title: string; readonly state: LiveState };
}

const toLiveComment = (wire: LiveCommentWire): LiveComment => ({ id: wire.id, authorName: wire.author.name || wire.author.username, text: wire.text, createdAt: wire.createdAt });

const buildEarnings = (coins = 0, giftCount = 0): LiveEarnings => ({ coins, giftCount, topGifters: [] });

const toLiveSession = (wire: StudioLiveWire): LiveSession => ({
  id: wire.id,
  title: wire.title,
  category: wire.category,
  state: wire.state,
  createdAt: wire.createdAt,
  startedAt: wire.startedAt,
  endedAt: wire.endedAt,
  viewers: wire.viewers,
  peakViewers: wire.peakViewers,
  hlsUrl: wire.hlsUrl,
  earnings: buildEarnings(wire.earnings.coins, wire.earnings.giftCount),
});

const toEarnings = (stats: StreamStatsWire | null): LiveEarnings =>
  stats
    ? { ...buildEarnings(stats.creatorCoins, stats.giftCount), topGifters: stats.topSupporters.map((entry) => ({ id: entry.user.id, name: entry.user.name || entry.user.username, coins: entry.coins })) }
    : buildEarnings();

const toStreamKey = (wire: StreamKeyWire): StreamKey => ({ ingestUrl: wire.ingestUrl, streamKey: wire.streamKey });

const toLiveProduct = (wire: SellerProductWire): LiveProduct | null => {
  const price = wire.variants[0]?.price;
  return price ? { id: wire.id, title: wire.name, price, imageUrl: wire.images[0]?.url ?? null, pinned: false } : null;
};

const withoutEmptyImageSource = (layer: OverlayLayer): OverlayLayer => {
  if (layer.src) return layer;
  const { src: _emptySource, ...rest } = layer;
  return rest;
};

const listSellerProducts = async (): Promise<LiveProduct[]> =>
  (await sendRequestToStudioServer<Page<SellerProductWire>>("/api/v1/seller/products", { query: { status: "active", limit: 100 } })).data
    .map(toLiveProduct)
    .filter((product): product is LiveProduct => product !== null);

const fetchSellerProduct = async (productId: ID): Promise<LiveProduct | null> =>
  toLiveProduct(await sendRequestToStudioServer<SellerProductWire>(`/api/v1/seller/products/${productId}`));

export const livesService = {
  listLives: async () => (await sendRequestToStudioServer<Page<StudioLiveWire>>("/api/v1/lives")).data.map(toLiveSession),
  fetchLiveById: async (liveId: ID): Promise<LiveDetail> => {
    const [live, stats] = await Promise.all([
      sendRequestToStudioServer<LiveSessionWire>(`/api/v1/lives/${liveId}`),
      sendRequestToStudioServer<StreamStatsWire>(`/api/v1/creators/me/analytics/gifts/streams/${liveId}`).catch(() => null),
    ]);
    return {
      id: live.id,
      title: live.title,
      category: live.category,
      state: live.state,
      startedAt: live.startedAt,
      endedAt: live.endedAt,
      viewers: live.viewers,
      peakViewers: live.peakViewers,
      hlsUrl: live.playbackUrl,
      storeId: live.storeId ?? null,
      hostRanking: live.hostRanking ?? null,
      earnings: toEarnings(stats),
    };
  },
  startLive: async (liveId: ID) => {
    await sendRequestToStudioServer<LiveSessionWire>(`/api/v1/lives/${liveId}/start`, { method: "POST" });
  },
  endLive: (liveId: ID) => sendRequestToStudioServer<void>(`/api/v1/lives/${liveId}/end`, { method: "POST" }),
  fetchStreamKey: async (liveId: ID): Promise<StreamKey | null> => {
    try {
      return toStreamKey(await sendRequestToStudioServer<StreamKeyWire>(`/api/v1/lives/${liveId}/stream-key`));
    } catch (error) {
      if (isNotFoundError(error)) return null;
      throw error;
    }
  },
  rotateStreamKey: async (liveId: ID) => toStreamKey(await sendRequestToStudioServer<StreamKeyWire>(`/api/v1/lives/${liveId}/stream-key`, { method: "POST" })),
  createLive: ({ title, category, storeId }: CreateLiveInput) =>
    sendRequestToStudioServer<LiveSessionWire>("/api/v1/lives", { method: "POST", body: { title, category, startNow: false, ...(storeId ? { storeId } : {}) } }),
  listMyStores: async (): Promise<StoreOption[]> =>
    (await sendRequestToStudioServer<Page<MyStoreWire>>("/api/v1/seller/stores/mine")).data.map((store) => ({ id: store.storeId, name: store.storeName, isCurrent: store.isCurrent })),
  listComments: async (liveId: ID) =>
    (await sendRequestToStudioServer<Page<LiveCommentWire>>(`/api/v1/lives/${liveId}/comments`)).data.map(toLiveComment),
  postComment: async (liveId: ID, text: string) =>
    toLiveComment(await sendRequestToStudioServer<LiveCommentWire>(`/api/v1/lives/${liveId}/comments`, { method: "POST", body: { text } })),
  listPinnedProducts: async (liveId: ID): Promise<LiveProduct[]> => {
    const [pins, catalogue] = await Promise.all([sendRequestToStudioServer<Page<LiveProductPinWire>>(`/api/v1/lives/${liveId}/products`), listSellerProducts()]);
    const productsById = new Map(catalogue.map((product) => [product.id, product]));
    const products = await Promise.all(pins.data.map(async (pin) => {
      const product = productsById.get(pin.productId) ?? (await fetchSellerProduct(pin.productId).catch(() => null));
      return product ? { ...product, pinned: pin.pinned } : null;
    }));
    return products.filter((product): product is LiveProduct => product !== null);
  },
  pinProduct: (liveId: ID, productId: ID) => sendRequestToStudioServer<Page<LiveProductPinWire>>(`/api/v1/lives/${liveId}/pins`, { method: "POST", body: { productId } }),
  unpinProduct: (liveId: ID) => sendRequestToStudioServer<Page<LiveProductPinWire>>(`/api/v1/lives/${liveId}/pins`, { method: "DELETE" }),
  listPinneableProducts: listSellerProducts,
  fetchOverlays: (liveId: ID) => sendRequestToStudioServer<OverlayScene>(`/api/v1/lives/${liveId}/overlays`),
  saveOverlays: (liveId: ID, scene: { readonly name: string; readonly layers: readonly OverlayLayer[] }) =>
    sendRequestToStudioServer<OverlayScene>(`/api/v1/lives/${liveId}/overlays`, { method: "PUT", body: { name: scene.name, layers: scene.layers.map(withoutEmptyImageSource) } }),
  fetchOverlayScene: (sceneId: ID) => sendRequestToStudioServer<OverlayScenePayload>(`/api/v1/overlay-scenes/${sceneId}`),
};
