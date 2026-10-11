export type FollowStateContract = "none" | "requested" | "accepted" | "rejected" | "blocked";

export type PostNotificationLevelContract = "off" | "posts" | "posts_and_lives";

export interface FollowStatusContract {
  readonly state: FollowStateContract;
  readonly followedBy: boolean;
  readonly followersCount: number;
  readonly followingCount: number;
  readonly viewerPostNotifications: PostNotificationLevelContract;
}

export interface PostNotificationsSettingContract {
  readonly level: PostNotificationLevelContract;
  readonly following: boolean;
}

export interface UpdatePostNotificationsRequestContract {
  readonly level: PostNotificationLevelContract;
}
