import { forbidden, notFound } from "../../../../errors/social.error.js";
import type { UserSummary } from "../../../../interfaces/identityDirectory.interface.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { postRepository } from "../../repositories/post.repository.js";
import { buildLastSevenDays, type DailyImpressions } from "../../services/postAnalytics.service.js";
import type { GetPostAnalyticsQuery } from "./getPostAnalytics.query.js";

export interface PostAnalyticsView {
  readonly postId: string;
  readonly author: UserSummary;
  readonly postedAt: string;
  readonly impressions: number;
  readonly uniqueViewers: number;
  readonly reach: number;
  readonly likes: number;
  readonly comments: number;
  readonly reposts: number;
  readonly shares: number;
  readonly saves: number;
  readonly profileVisits: number;
  readonly daily: readonly DailyImpressions[];
}

export function createGetPostAnalyticsHandler(context: HandlerContext): Handler<GetPostAnalyticsQuery, PostAnalyticsView> {
  return async ({ viewerId, postId }) => {
    const db = context.database.client;
    const post = await postRepository.findById(db, postId);
    if (post === null) throw notFound("POST_NOT_FOUND", "Post not found.");
    if (post.authorId !== viewerId) throw forbidden("NOT_POST_OWNER", "Only the author can see these analytics.");
    const now = context.clock.now();
    const since = new Date(now.getTime() - 6 * 86_400_000).toISOString().slice(0, 10);
    const [stats, uniqueViewers, saves, authors] = await Promise.all([
      db.postDailyStat.findMany({ where: { postId, day: { gte: since } } }),
      db.postViewer.count({ where: { postId } }),
      db.savedItem.count({ where: { targetId: postId, type: { in: ["post", "video", "clip"] } } }),
      context.directory.findUserSummaries([viewerId]),
    ]);
    return {
      postId, author: authors.get(viewerId) ?? { id: viewerId, name: "", username: "", avatarUrl: null, verified: false, isCreator: false }, postedAt: post.createdAt.toISOString(),
      impressions: post.viewCount, uniqueViewers, reach: uniqueViewers, likes: post.likeCount, comments: post.commentCount, reposts: post.repostCount, shares: post.shareCount, saves,
      profileVisits: post.profileVisitCount, daily: buildLastSevenDays(now, new Map(stats.map((stat) => [stat.day, stat.impressions]))),
    };
  };
}
