import type { PostView } from "../../posts/models/post.model.js";

export type SavedItemTypeName = "post" | "video" | "clip" | "product";
export type SavedItemFilter = "all" | SavedItemTypeName;

export interface SavedItemPreview {
  readonly title: string | null;
  readonly thumbnailUrl: string | null;
  readonly href: string;
  readonly author: string | null;
  readonly price: null;
  readonly durationSeconds: number | null;
}

export interface SavedItemView {
  readonly id: string;
  readonly type: SavedItemTypeName;
  readonly targetId: string;
  readonly savedAt: string;
  readonly collectionId: string | null;
  readonly preview: SavedItemPreview;
  readonly post?: PostView;
  readonly clip?: PostView;
}

export interface SaveCollectionView {
  readonly id: string;
  readonly name: string;
  readonly itemCount: number;
  readonly coverUrl: string | null;
}
