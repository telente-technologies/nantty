export type FeedInteractionKind = "view" | "dwell" | "watch" | "link_click" | "profile_click" | "follow";

export interface RecordFeedInteractionCommand {
  readonly viewerId: string | undefined;
  readonly postId: string;
  readonly kind: FeedInteractionKind;
  readonly dwellMs?: number | undefined;
  readonly watchFraction?: number | undefined;
  readonly watchMs?: number | undefined;
  readonly loopCount?: number | undefined;
  readonly durationMs?: number | undefined;
  readonly position?: number | undefined;
  readonly surface?: string | undefined;
  readonly rankingRequestId?: string | undefined;
}
