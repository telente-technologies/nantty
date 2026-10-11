import type { QueryClient } from "@tanstack/react-query";

import type { FollowState, FollowStatus, PostNotificationLevel } from "@/types/socialGraph.type";

import { setFollowingAuthorEverywhere, updateMatchingRecordsInEveryQuery } from "./postEngagementCache.util";

export const followQueryKeys = {
  followStatus: (userId: string) => ["users", userId, "followStatus"] as const,
};

const isUserRecordWithId = (userId: string) => (record: Record<string, unknown>) =>
  record.id === userId && ("followState" in record || "isFollowing" in record);

export function setUserFollowStateEverywhere(queryClient: QueryClient, userId: string, state: FollowState) {
  const isFollowing = state === "accepted";
  setFollowingAuthorEverywhere(queryClient, userId, isFollowing);
  updateMatchingRecordsInEveryQuery(queryClient, isUserRecordWithId(userId), (user) =>
    user.followState === state && user.isFollowing === isFollowing ? user : { ...user, followState: state, isFollowing },
  );
  queryClient.setQueryData<FollowStatus>(followQueryKeys.followStatus(userId), (status) =>
    status ? { ...status, state, viewerPostNotifications: isFollowing ? status.viewerPostNotifications : "off" } : status,
  );
}

export function setPostNotificationLevelInCache(queryClient: QueryClient, userId: string, level: PostNotificationLevel) {
  queryClient.setQueryData<FollowStatus>(followQueryKeys.followStatus(userId), (status) => (status ? { ...status, viewerPostNotifications: level } : status));
}
