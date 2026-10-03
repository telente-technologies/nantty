import type { ID, LiveCategory, LiveComment, LiveProduct, LiveSession, LiveState, OverlayLayer, OverlayScene } from "@/types";

import { sendRequestToStudioServer } from "./clientApi.service";

export interface OverlayScenePayload {
  readonly scene: OverlayScene;
  readonly live: { readonly id: ID; readonly title: string; readonly state: LiveState };
}

export const livesService = {
  listLives: () => sendRequestToStudioServer<LiveSession[]>("/api/v1/lives"),
  fetchLiveById: (liveId: ID) => sendRequestToStudioServer<LiveSession>(`/api/v1/lives/${liveId}`),
  startLive: (liveId: ID) => sendRequestToStudioServer<LiveSession>(`/api/v1/lives/${liveId}/start`, { method: "POST" }),
  endLive: (liveId: ID) => sendRequestToStudioServer<LiveSession>(`/api/v1/lives/${liveId}/end`, { method: "POST" }),
  rotateStreamKey: (liveId: ID) => sendRequestToStudioServer<LiveSession>(`/api/v1/lives/${liveId}/stream-key`, { method: "POST" }),
  createLive: (title: string, category: LiveCategory) =>
    sendRequestToStudioServer<LiveSession>("/api/v1/lives", { method: "POST", body: { title, category } }),
  listComments: (liveId: ID) => sendRequestToStudioServer<LiveComment[]>(`/api/v1/lives/${liveId}/comments`),
  postComment: (liveId: ID, text: string) => sendRequestToStudioServer<LiveComment>(`/api/v1/lives/${liveId}/comments`, { method: "POST", body: { text } }),
  listPinnedProducts: (liveId: ID) => sendRequestToStudioServer<LiveProduct[]>(`/api/v1/lives/${liveId}/products`),
  pinProduct: (liveId: ID, productId: ID) => sendRequestToStudioServer<LiveSession>(`/api/v1/lives/${liveId}/products`, { method: "POST", body: { productId } }),
  listPinneableProducts: () => sendRequestToStudioServer<LiveProduct[]>("/api/v1/live-products"),
  fetchOverlays: (liveId: ID) => sendRequestToStudioServer<OverlayScene>(`/api/v1/lives/${liveId}/overlays`),
  saveOverlays: (liveId: ID, scene: { readonly name: string; readonly layers: readonly OverlayLayer[] }) =>
    sendRequestToStudioServer<OverlayScene>(`/api/v1/lives/${liveId}/overlays`, { method: "PUT", body: scene }),
  fetchOverlayScene: (sceneId: ID) => sendRequestToStudioServer<OverlayScenePayload>(`/api/v1/overlay-scenes/${sceneId}`),
};
