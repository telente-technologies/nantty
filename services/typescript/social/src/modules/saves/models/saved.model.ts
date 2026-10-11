import type { PostView, TaggedProductView } from "../../posts/models/post.model.js";
import type { CommentView } from "../../comments/models/comment.model.js";

export type SavedItemTypeName = "post" | "video" | "clip" | "product" | "comment";
export type SavedItemFilter = "all" | SavedItemTypeName;

export interface SavedItemPreview {
  readonly title: string | null;
  readonly thumbnailUrl: string | null;
  readonly href: string;
  readonly author: string | null;
  readonly price: TaggedProductView["price"] | null;
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
  readonly product?: TaggedProductView;
  readonly comment?: CommentView;
  readonly postId?: string;
}

export interface SaveCollectionView {
  readonly id: string;
  readonly name: string;
  readonly itemCount: number;
  readonly coverUrl: string | null;
}
