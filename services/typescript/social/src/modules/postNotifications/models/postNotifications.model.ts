export const postNotificationLevels = ["off", "posts", "posts_and_lives"] as const;

export type PostNotificationLevel = (typeof postNotificationLevels)[number];

export type PostNotificationScope = "posts" | "lives";

export interface PostNotificationsView {
  readonly level: PostNotificationLevel;
  readonly following: boolean;
}

export interface PostNotificationSubscriber {
  readonly userId: string;
}
