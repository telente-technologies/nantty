import type { SaveCollection, SaveTargetType } from "@/types";

export interface SavedTargetRecord {
  readonly saveId: string;
  readonly targetType: SaveTargetType;
  readonly targetId: string;
  readonly savedAt: string;
  readonly collectionId: string | null;
}

const hoursAgoIso = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();

export const buildSavedTargetKey = (targetType: SaveTargetType, targetId: string) => `${targetType}:${targetId}`;

const seedSavedTargets: readonly SavedTargetRecord[] = [
  { saveId: "save_1", targetType: "post", targetId: "post_3", savedAt: hoursAgoIso(3), collectionId: "col_owambe" },
  { saveId: "save_2", targetType: "clip", targetId: "clip_amaka_haul", savedAt: hoursAgoIso(6), collectionId: null },
  { saveId: "save_3", targetType: "product", targetId: "pr_f1", savedAt: hoursAgoIso(9), collectionId: "col_owambe" },
  { saveId: "save_4", targetType: "video", targetId: "video_bunny", savedAt: hoursAgoIso(20), collectionId: null },
  { saveId: "save_5", targetType: "post", targetId: "post_8", savedAt: hoursAgoIso(26), collectionId: "col_gadgets" },
  { saveId: "save_6", targetType: "product", targetId: "pr_g3", savedAt: hoursAgoIso(30), collectionId: "col_gadgets" },
  { saveId: "save_7", targetType: "clip", targetId: "clip_bisola_jollof", savedAt: hoursAgoIso(52), collectionId: null },
  { saveId: "save_8", targetType: "post", targetId: "post_12", savedAt: hoursAgoIso(70), collectionId: null },
];

export const savedTargetsByKey = new Map<string, SavedTargetRecord>(seedSavedTargets.map((record) => [buildSavedTargetKey(record.targetType, record.targetId), record]));

export const saveCollectionRecords: { id: string; name: string }[] = [
  { id: "col_owambe", name: "Owambe looks" },
  { id: "col_gadgets", name: "Gadget wishlist" },
];

export const isTargetSavedByViewer = (targetType: SaveTargetType, targetId: string): boolean => savedTargetsByKey.has(buildSavedTargetKey(targetType, targetId));

export const withViewerBookmarkState = <Item extends { readonly id: string; readonly bookmarked: boolean }>(item: Item, targetType: SaveTargetType): Item => ({
  ...item,
  bookmarked: isTargetSavedByViewer(targetType, item.id),
});

export const countSavedTargetsInCollection = (collectionId: string): number =>
  [...savedTargetsByKey.values()].filter((record) => record.collectionId === collectionId).length;

export const describeSaveCollection = (collection: { id: string; name: string }, coverUrl: string | null): SaveCollection => ({
  id: collection.id,
  name: collection.name,
  itemCount: countSavedTargetsInCollection(collection.id),
  coverUrl,
});

export const saveProductForViewer = (productId: string): void => {
  const key = buildSavedTargetKey("product", productId);
  if (!savedTargetsByKey.has(key)) savedTargetsByKey.set(key, { saveId: `save_${Date.now().toString(36)}`, targetType: "product", targetId: productId, savedAt: new Date().toISOString(), collectionId: null });
};
