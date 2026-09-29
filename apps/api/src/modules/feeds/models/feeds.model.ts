export type FeedInteractionKind = "view" | "click" | "share" | "dwell";

export interface FeedInteractionRecord {
  readonly id: string;
  readonly userId: string;
  readonly postId: string;
  readonly kind: FeedInteractionKind;
  readonly createdAt: Date;
}
