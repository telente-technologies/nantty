import type { Page } from "@/types";
import type { Follower, MyPost, PostAnalytics, RankingBoard, RankingEntry, RankingPeriod } from "@/types/audience.type";

import { sendRequestToStudioServer } from "./clientApi.service";

export const contentService = {
  listMyPosts: (userId: string, kind: "post" | "clip" | null, cursor?: string) =>
    sendRequestToStudioServer<Page<MyPost>>(`/api/v1/users/${encodeURIComponent(userId)}/posts`, { query: { kind, cursor, limit: 20 } }),
  fetchPostAnalytics: (postId: string) => sendRequestToStudioServer<PostAnalytics>(`/api/v1/posts/${encodeURIComponent(postId)}/analytics`),
  listFollowers: (cursor?: string) => sendRequestToStudioServer<Page<Follower>>("/api/v1/users/me/followers", { query: { cursor, limit: 20 } }),
  fetchRankings: (board: RankingBoard, period: RankingPeriod) => sendRequestToStudioServer<Page<RankingEntry>>("/api/v1/rankings", { query: { board, period, scope: "global" } }),
};
