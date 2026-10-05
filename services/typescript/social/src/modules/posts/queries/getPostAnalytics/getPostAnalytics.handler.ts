import { forbidden, notFound } from "../../../../errors/social.error.js";
import type { UserSummary } from "../../../../interfaces/identityDirectory.interface.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { postRepository } from "../../repositories/post.repository.js";
import { buildAudienceSplit, buildLastSevenDays, summariseEngagement, type DailyImpressions } from "../../services/postAnalytics.service.js";
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
  readonly profileClicks: number;
  readonly linkClicks: number;
  readonly newFollows: number;
  readonly engagements: number;
  readonly engagementRate: number;
  readonly video: { readonly views: number; readonly watchTimeSeconds: number } | null;
  readonly audience: readonly { readonly label: string; readonly share: number }[];
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
    const [stats, totals, uniqueViewers, saves, authors, viewerKeys] = await Promise.all([
      db.postDailyStat.findMany({ where: { postId, day: { gte: since } } }),
      db.postDailyStat.aggregate({ where: { postId }, _sum: { videoViews: true, watchTimeSeconds: true, linkClicks: true, newFollows: true } }),
      db.postViewer.count({ where: { postId } }),
      db.savedItem.count({ where: { targetId: postId, type: { in: ["post", "video", "clip"] } } }),
      context.directory.findUserSummaries([viewerId]),
      db.postViewer.findMany({ where: { postId, viewerKey: { not: "anonymous" } }, select: { viewerKey: true }, take: 5000 }),
    ]);
    const followerViewers = viewerKeys.length === 0 ? 0 : await db.follow.count({ where: { followeeId: viewerId, state: "accepted", followerId: { in: viewerKeys.map((row) => row.viewerKey) } } });
    const engagement = summariseEngagement({ likes: post.likeCount, comments: post.commentCount, reposts: post.repostCount, shares: post.shareCount, saves }, post.viewCount);
    const hasVideo = post.media.some((media) => media.type === "video");
    return {
      postId, author: authors.get(viewerId) ?? { id: viewerId, name: "", username: "", avatarUrl: null, verified: false, isCreator: false }, postedAt: post.createdAt.toISOString(),
      impressions: post.viewCount, uniqueViewers, reach: uniqueViewers, likes: post.likeCount, comments: post.commentCount, reposts: post.repostCount, shares: post.shareCount, saves,
      profileVisits: post.profileVisitCount, profileClicks: post.profileVisitCount, linkClicks: totals._sum.linkClicks ?? 0, newFollows: totals._sum.newFollows ?? 0, ...engagement,
      video: hasVideo ? { views: totals._sum.videoViews ?? 0, watchTimeSeconds: totals._sum.watchTimeSeconds ?? 0 } : null,
      audience: buildAudienceSplit(followerViewers, viewerKeys.length), daily: buildLastSevenDays(now, new Map(stats.map((stat) => [stat.day, stat.impressions]))),
    };
  };
}
