import { buildProductPath } from "@/utils/seoPaths.util";
import { ApiError } from "@/errors/api.error";
import type { Page, SavedItem, SavedItemFilter, SaveTargetRequest, SaveTargetType } from "@/types";

import { findMockClipsByIds } from "./clips.mock";
import { findPostIncludingSponsored } from "./posts.mock";
import { buildCatalogProductSummary, findCatalogSeedByProductId } from "./productCatalog.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";
import { buildSavedTargetKey, describeSaveCollection, saveCollectionRecords, savedTargetsByKey, type SavedTargetRecord } from "./saveState.mock";
import { findMockVideoById } from "./videos.mock";

const SAVES_PAGE_SIZE = 12;
const saveTargetTypes: readonly SaveTargetType[] = ["post", "video", "clip", "product"];

const isSaveTargetType = (value: unknown): value is SaveTargetType => saveTargetTypes.includes(value as SaveTargetType);

const firstMediaThumbnail = (media: readonly { type: string; url: string | null; posterUrl?: string | null }[]) => {
  const first = media[0];
  if (!first) return null;
  return first.type === "image" ? first.url : (first.posterUrl ?? null);
};

const buildSavedItem = (record: SavedTargetRecord): SavedItem | null => {
  const base = { id: record.saveId, type: record.targetType, targetId: record.targetId, savedAt: record.savedAt, collectionId: record.collectionId };
  if (record.targetType === "product") {
    const seed = findCatalogSeedByProductId(record.targetId);
    if (!seed) return null;
    const product = buildCatalogProductSummary(seed);
    return { ...base, preview: { title: product.name, thumbnailUrl: product.imageUrl, href: buildProductPath(product), author: null, price: product.price, durationSeconds: null } };
  }
  const post = record.targetType === "clip" ? findMockClipsByIds([record.targetId])[0] : record.targetType === "video" ? findMockVideoById(record.targetId) : findPostIncludingSponsored(record.targetId);
  if (!post) return null;
  const href = record.targetType === "clip" ? `/clips?start=${post.id}` : record.targetType === "video" ? `/watch/${post.id}` : `/post/${post.id}`;
  return {
    ...base,
    preview: { title: post.text, thumbnailUrl: firstMediaThumbnail(post.media), href, author: post.author, price: null, durationSeconds: post.media[0]?.durationSeconds ?? null },
  };
};

const listSavedItems = (filter: SavedItemFilter, collectionId: string | null): SavedItem[] =>
  [...savedTargetsByKey.values()]
    .filter((record) => (filter === "all" || record.targetType === filter) && (!collectionId || record.collectionId === collectionId))
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt))
    .map(buildSavedItem)
    .filter((item): item is SavedItem => item !== null);

const pageOfSavedItems = (items: SavedItem[], cursor: string | null): Page<SavedItem> => {
  const start = Number(cursor ?? 0) || 0;
  const end = start + SAVES_PAGE_SIZE;
  return { data: items.slice(start, end), nextCursor: end < items.length ? String(end) : null };
};

const describeEveryCollection = () =>
  saveCollectionRecords.map((collection) => {
    const cover = listSavedItems("all", collection.id)[0]?.preview.thumbnailUrl ?? null;
    return describeSaveCollection(collection, cover);
  });

export const savesMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/saves/collections", describeEveryCollection),
  createMockRoute("POST", "/api/v1/saves/collections", ({ body }) => {
    const name = String((body as { name?: unknown })?.name ?? "").trim();
    if (name.length < 1 || name.length > 40) throw new ApiError(422, "Collection names must be 1 to 40 characters");
    const collection = { id: `col_${Date.now().toString(36)}`, name };
    saveCollectionRecords.push(collection);
    return describeSaveCollection(collection, null);
  }),
  createMockRoute("GET", "/api/v1/saves", ({ query }) => {
    const requestedType = query.get("type") ?? "all";
    const filter: SavedItemFilter = isSaveTargetType(requestedType) ? requestedType : "all";
    return pageOfSavedItems(listSavedItems(filter, query.get("collectionId")), query.get("cursor"));
  }),
  createMockRoute("POST", "/api/v1/saves", ({ body }) => {
    const { type: targetType, targetId, collectionId = null } = (body ?? {}) as Partial<SaveTargetRequest>;
    if (!isSaveTargetType(targetType) || typeof targetId !== "string" || targetId.length === 0) throw new ApiError(422, "Choose something to save");
    if (collectionId && !saveCollectionRecords.some((collection) => collection.id === collectionId)) throw new ApiError(404, "That collection no longer exists");
    const key = buildSavedTargetKey(targetType, targetId);
    const record = savedTargetsByKey.get(key) ?? { saveId: `save_${Date.now().toString(36)}`, targetType, targetId, savedAt: new Date().toISOString(), collectionId };
    savedTargetsByKey.set(key, record);
    const item = buildSavedItem(record);
    if (!item) {
      savedTargetsByKey.delete(key);
      throw new ApiError(404, "This item is no longer available");
    }
    return item;
  }),
  createMockRoute("DELETE", "/api/v1/saves", ({ query }) => {
    const targetType = query.get("type");
    const targetId = query.get("targetId");
    if (!isSaveTargetType(targetType) || !targetId) throw new ApiError(422, "Choose something to remove");
    savedTargetsByKey.delete(buildSavedTargetKey(targetType, targetId));
  }),
  createMockRoute("PATCH", "/api/v1/saves/:saveId", ({ params, body }) => {
    const collectionId = (body as { collectionId?: string | null })?.collectionId ?? null;
    const entry = [...savedTargetsByKey.entries()].find(([, record]) => record.saveId === params.saveId);
    if (!entry) throw new ApiError(404, "This save no longer exists");
    if (collectionId && !saveCollectionRecords.some((collection) => collection.id === collectionId)) throw new ApiError(404, "That collection no longer exists");
    const updated = { ...entry[1], collectionId };
    savedTargetsByKey.set(entry[0], updated);
    return buildSavedItem(updated);
  }),
];
