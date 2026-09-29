export type FeedInteractionKind = "view" | "click" | "share" | "dwell" | "watch" | "hide" | "not_interested";

export const FEED_HIDING_INTERACTION_KINDS: readonly FeedInteractionKind[] = ["hide", "not_interested"];

export interface FeedInteractionRecord {
  readonly id: string;
  readonly userId: string;
  readonly postId: string;
  readonly kind: FeedInteractionKind;
  readonly createdAt: Date;
}

export interface FeedInteractionSignals {
  readonly dwellMs?: number;
  readonly watchFraction?: number;
  readonly loopCount?: number;
  readonly durationMs?: number;
  readonly position?: number;
  readonly surface?: string;
  readonly rankingRequestId?: string;
  readonly deviceClass?: "android" | "ios" | "web" | "other";
}

export interface ProductInteractionSignal {
  readonly productId: string;
  readonly kind: "product_view" | "add_to_cart";
  readonly quantity?: number;
  readonly sourcePostId?: string;
}
