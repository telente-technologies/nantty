import type { ContentEnforcementAction, ModerationTargetGateway } from "../../../interfaces/moderationTargets.interface.js";
import type { PostsService } from "./posts.service.js";

const SUMMARY_LENGTH = 140;

export function createPostsModerationTargets(postsService: PostsService): readonly ModerationTargetGateway[] {
  const { posts, interactions, liveSessions } = postsService.dependencies;
  const hides = (action: ContentEnforcementAction) => action === "hide" || action === "remove";
  return [
    {
      targetType: "post",
      describeTarget: async (postId) => {
        const post = await posts.findById(postId);
        return post === undefined || post.deletedAt !== null ? undefined : { ownerUserId: post.authorId, summary: post.text.slice(0, SUMMARY_LENGTH) || `${post.kind} by author` };
      },
      applyContentAction: async (postId, action, decidedAt) => {
        if (!hides(action)) return false;
        await posts.markDeleted(postId, decidedAt);
        return true;
      },
    },
    {
      targetType: "comment",
      describeTarget: async (commentId) => {
        const comment = await interactions.findComment(commentId);
        return comment === undefined || comment.deletedAt !== null ? undefined : { ownerUserId: comment.authorId, summary: comment.text.slice(0, SUMMARY_LENGTH) };
      },
      applyContentAction: async (commentId, action, decidedAt) => hides(action) && interactions.markCommentDeleted(commentId, decidedAt),
    },
    {
      targetType: "live",
      describeTarget: async (liveId) => {
        const session = await liveSessions.findById(liveId);
        return session === undefined ? undefined : { ownerUserId: session.hostId, summary: session.title.slice(0, SUMMARY_LENGTH) };
      },
      applyContentAction: async (liveId, action, decidedAt) => hides(action) && liveSessions.end(liveId, decidedAt),
    },
  ];
}
