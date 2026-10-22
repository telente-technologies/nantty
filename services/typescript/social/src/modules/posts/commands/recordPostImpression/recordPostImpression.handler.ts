import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { postRepository } from "../../repositories/post.repository.js";
import { loadPostVisibleToViewer } from "../../services/postAccess.service.js";
import { claimViewerCooldown } from "../../services/postViewerCounters.service.js";
import type { RecordPostImpressionCommand } from "./recordPostImpression.command.js";

export function createRecordPostImpressionHandler(context: HandlerContext): Handler<RecordPostImpressionCommand, void> {
  return async ({ viewerId, postId }) => {
    if (viewerId === undefined) return;
    const post = await loadPostVisibleToViewer(context, viewerId, postId);
    if (viewerId === post.authorId) return;
    const now = context.clock.now();
    const day = now.toISOString().slice(0, 10);
    await context.database.transaction(async (transaction) => {
      if (!(await claimViewerCooldown(transaction, postId, viewerId, "lastViewedAt", now))) return;
      await transaction.postDailyStat.upsert({ where: { postId_day: { postId, day } }, create: { postId, day, impressions: 1 }, update: { impressions: { increment: 1 } } });
      await postRepository.incrementCounter(transaction, postId, "viewCount", 1);
    });
  };
}
