export interface SocialGraph {
  isBlockedEitherWay(userId: string, otherUserId: string): Promise<boolean>;
  isFollowingUser(followerId: string, followedUserId: string): Promise<boolean>;
  listFollowedUserIds(userId: string): Promise<readonly string[]>;
  listFollowedStoreIds(userId: string): Promise<readonly string[]>;
  countFollowers(targetType: "user" | "store", targetId: string): Promise<number>;
}
