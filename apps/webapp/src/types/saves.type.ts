import type { ID, ISODate, UserSummary } from "./models.type";
import type { Money } from "./money.type";

export type SaveTargetType = "post" | "video" | "clip" | "product" | "comment";
export type SavedItemFilter = "all" | SaveTargetType;

export interface SaveCollection {
  readonly id: ID;
  readonly name: string;
  readonly itemCount: number;
  readonly coverUrl: string | null;
}

export interface SavedItemPreview {
  readonly title: string;
  readonly thumbnailUrl: string | null;
  readonly href: string;
  readonly author: UserSummary | null;
  readonly price: Money | null;
  readonly durationSeconds: number | null;
}

export interface SavedItem {
  readonly id: ID;
  readonly type: SaveTargetType;
  readonly targetId: ID;
  readonly savedAt: ISODate;
  readonly collectionId: ID | null;
  readonly preview: SavedItemPreview;
}

export interface SaveTargetRequest {
  readonly type: SaveTargetType;
  readonly targetId: ID;
  readonly collectionId?: ID | null;
}

export interface TrendingTopic {
  readonly tag: string;
  readonly postCount: number;
  readonly category: string;
}
