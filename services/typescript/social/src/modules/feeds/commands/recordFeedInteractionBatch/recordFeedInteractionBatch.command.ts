import type { RecordFeedInteractionCommand } from "../recordFeedInteraction/recordFeedInteraction.command.js";

export interface RecordFeedInteractionBatchCommand {
  readonly viewerId: string;
  readonly events: readonly Omit<RecordFeedInteractionCommand, "viewerId">[];
}

export interface FeedInteractionBatchResult {
  readonly accepted: number;
  readonly skipped: number;
}
