export type FeedInteractionKindContract = "view" | "dwell" | "watch" | "link_click" | "profile_click" | "follow";
export type FeedInteractionSurfaceContract = "feed" | "clips" | "profile" | "post_detail" | "explore" | "hashtag" | "search";

export interface FeedInteractionContract {
  readonly postId: string;
  readonly kind: FeedInteractionKindContract;
  readonly dwellMs?: number;
  readonly watchFraction?: number;
  readonly watchMs?: number;
  readonly loopCount?: number;
  readonly durationMs?: number;
  readonly position?: number;
  readonly surface?: FeedInteractionSurfaceContract;
  readonly rankingRequestId?: string;
}

export interface FeedInteractionBatchBodyContract {
  readonly events: readonly FeedInteractionContract[];
}

export interface FeedInteractionBatchResultContract {
  readonly accepted: number;
  readonly skipped: number;
}

export const feedInteractionBatchPathContract = "/api/v1/feeds/interactions/batch";
export const maximumFeedInteractionsPerBatchContract = 50;
export const feedInteractionRepeatCooldownMsContract = 600_000;
