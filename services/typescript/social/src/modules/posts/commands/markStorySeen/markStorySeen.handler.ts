import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { notFound } from "../../../../errors/social.error.js";
import { postRepository } from "../../repositories/post.repository.js";
import { loadPostVisibleToViewer } from "../../services/postAccess.service.js";
import type { MarkStorySeenCommand } from "./markStorySeen.command.js";

export function createMarkStorySeenHandler(context: HandlerContext): Handler<MarkStorySeenCommand, void> {
  return async ({ viewerId, storyId }) => {
    const story = await loadPostVisibleToViewer(context, viewerId, storyId);
    if (story.kind !== "story") throw notFound("STORY_NOT_FOUND", "Story not found.");
    // An account owner viewing its own account or postable-profile story is
    // not an audience impression.
    if (
      viewerId === story.authorId ||
      (story.authorProfileId !== null && (await context.directory.findOwnedPostableProfile(viewerId, story.authorProfileId)) !== null)
    ) return;

    const now = context.clock.now();
    const day = now.toISOString().slice(0, 10);
    await context.database.transaction(async (transaction) => {
      // StoryView is unique by (storyId, viewerId), so only the first view is
      // counted. This keeps retries and repeated playback from inflating metrics.
      if ((await postRepository.markStoryViewed(transaction, storyId, viewerId)).count !== 1) return;
      await transaction.post.update({ where: { id: storyId }, data: { viewCount: { increment: 1 } } });
      await transaction.postDailyStat.upsert({
        where: { postId_day: { postId: storyId, day } },
        create: { postId: storyId, day, impressions: 1 },
        update: { impressions: { increment: 1 } },
      });
    });
  };
}
