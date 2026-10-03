import type { ID, ISODate, Post, ProductSummary } from "./models.type";
import type { Clip } from "./social.type";

export type SavedItemType = "post" | "video" | "clip" | "product";
export type SavedItemFilter = "all" | SavedItemType;

export interface SaveTarget {
  readonly type: SavedItemType;
  readonly targetId: ID;
}

interface SavedItemBase {
  readonly id: ID;
  readonly targetId: ID;
  readonly savedAt: ISODate;
}

export type SavedItem =
  | (SavedItemBase & { readonly type: "post" | "video"; readonly post: Post })
  | (SavedItemBase & { readonly type: "clip"; readonly clip: Clip })
  | (SavedItemBase & { readonly type: "product"; readonly product: ProductSummary });

export const saveTargetForPost = (post: Post): SaveTarget => ({
  type: post.kind === "clip" ? "clip" : post.media.some((media) => media.type === "video") ? "video" : "post",
  targetId: post.id,
});
