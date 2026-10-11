import { SocialError } from "../../../../errors/social.error.js";
import type { Handler } from "../../../../types/handlerContext.type.js";
import type { RecordFeedInteractionCommand } from "../recordFeedInteraction/recordFeedInteraction.command.js";
import type { FeedInteractionBatchResult, RecordFeedInteractionBatchCommand } from "./recordFeedInteractionBatch.command.js";

const skippableStatuses = new Set([403, 404, 410]);

export function createRecordFeedInteractionBatchHandler(recordOne: Handler<RecordFeedInteractionCommand, void>): Handler<RecordFeedInteractionBatchCommand, FeedInteractionBatchResult> {
  return async ({ viewerId, events }) => {
    let accepted = 0;
    let skipped = 0;
    for (const event of events) {
      try {
        await recordOne({ ...event, viewerId });
        accepted += 1;
      } catch (error) {
        if (!(error instanceof SocialError) || !skippableStatuses.has(error.status)) throw error;
        skipped += 1;
      }
    }
    return { accepted, skipped };
  };
}
