import type { ID, LiveCategory, LiveComment, LiveCommentWire, LiveProduct, LiveSession, LiveState, OverlayLayer, OverlayScene, Page } from "@/types";

import { sendRequestToStudioServer } from "./clientApi.service";

export interface OverlayScenePayload {
  readonly scene: OverlayScene;
  readonly live: { readonly id: ID; readonly title: string; readonly state: LiveState };
}

const toLiveComment = (wire: LiveCommentWire): LiveComment => ({ id: wire.id, authorName: wire.author.name || wire.author.username, text: wire.text, createdAt: wire.createdAt });

const readList = <T>(payload: T[] | Page<T>): T[] => (Array.isArray(payload) ? payload : [...payload.data]);

export const livesService = {
  listLives: async () => readList(await sendRequestToStudioServer<LiveSession[] | Page<LiveSession>>("/api/v1/lives")),
  fetchLiveById: (liveId: ID) => sendRequestToStudioServer<LiveSession>(`/api/v1/lives/${liveId}`),
  startLive: (liveId: ID) => sendRequestToStudioServer<LiveSession>(`/api/v1/lives/${liveId}/start`, { method: "POST" }),
  endLive: (liveId: ID) => sendRequestToStudioServer<LiveSession>(`/api/v1/lives/${liveId}/end`, { method: "POST" }),
  rotateStreamKey: (liveId: ID) => sendRequestToStudioServer<LiveSession>(`/api/v1/lives/${liveId}/stream-key`, { method: "POST" }),
  createLive: (title: string, category: LiveCategory) =>
    sendRequestToStudioServer<LiveSession>("/api/v1/lives", { method: "POST", body: { title, category } }),
  listComments: async (liveId: ID) =>
    (await sendRequestToStudioServer<Page<LiveCommentWire>>(`/api/v1/lives/${liveId}/comments`)).data.map(toLiveComment),
  postComment: async (liveId: ID, text: string) =>
    toLiveComment(await sendRequestToStudioServer<LiveCommentWire>(`/api/v1/lives/${liveId}/comments`, { method: "POST", body: { text } })),
  listPinnedProducts: async (liveId: ID) => readList(await sendRequestToStudioServer<LiveProduct[] | Page<LiveProduct>>(`/api/v1/lives/${liveId}/products`)),
  pinProduct: (liveId: ID, productId: ID) => sendRequestToStudioServer<LiveSession>(`/api/v1/lives/${liveId}/products`, { method: "POST", body: { productId } }),
  listPinneableProducts: async () => readList(await sendRequestToStudioServer<LiveProduct[] | Page<LiveProduct>>("/api/v1/live-products")),
  fetchOverlays: (liveId: ID) => sendRequestToStudioServer<OverlayScene>(`/api/v1/lives/${liveId}/overlays`),
  saveOverlays: (liveId: ID, scene: { readonly name: string; readonly layers: readonly OverlayLayer[] }) =>
    sendRequestToStudioServer<OverlayScene>(`/api/v1/lives/${liveId}/overlays`, { method: "PUT", body: scene }),
  fetchOverlayScene: (sceneId: ID) => sendRequestToStudioServer<OverlayScenePayload>(`/api/v1/overlay-scenes/${sceneId}`),
};
