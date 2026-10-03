import type { ID, Page, SaveCollection, SavedItem, SavedItemFilter, SaveTargetRequest, SaveTargetType } from "@/types";

import { createIdempotencyKey, sendRequestToWebappServer } from "./clientApi.service";

export const savesService = {
  saveTarget: (request: SaveTargetRequest) =>
    sendRequestToWebappServer<SavedItem>("/api/v1/saves", { method: "POST", body: request, idempotencyKey: createIdempotencyKey("save") }),
  removeSavedTarget: (targetType: SaveTargetType, targetId: ID) =>
    sendRequestToWebappServer<void>("/api/v1/saves", { method: "DELETE", query: { type: targetType, targetId } }),
  fetchSavedItemsPage: (filter: SavedItemFilter, collectionId: ID | null, cursor: string | null) =>
    sendRequestToWebappServer<Page<SavedItem>>("/api/v1/saves", { query: { type: filter, collectionId: collectionId ?? undefined, cursor: cursor ?? undefined } }),
  fetchSaveCollections: () => sendRequestToWebappServer<SaveCollection[]>("/api/v1/saves/collections"),
  createSaveCollection: (name: string) => sendRequestToWebappServer<SaveCollection>("/api/v1/saves/collections", { method: "POST", body: { name } }),
  moveSavedItemToCollection: (saveId: ID, collectionId: ID | null) =>
    sendRequestToWebappServer<SavedItem>(`/api/v1/saves/${saveId}`, { method: "PATCH", body: { collectionId } }),
};
