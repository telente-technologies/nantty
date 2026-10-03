import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { feedRepository } from "../../repositories/feed.repository.js";
import type { RecordFeedFeedbackCommand } from "./recordFeedFeedback.command.js";

export function createRecordFeedFeedbackHandler(context: HandlerContext): Handler<RecordFeedFeedbackCommand, void> {
  return async ({ userId, postId, kind }) => {
    await feedRepository.recordFeedback(context.database.client, userId, postId, kind);
  };
}
