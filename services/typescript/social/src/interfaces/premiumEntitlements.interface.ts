export interface PremiumEntitlements {
  isPremium(accountId: string): Promise<boolean>;
  hasSubscribedToCreator(viewerId: string, creatorId: string): Promise<boolean>;
  canSchedulePosts(accountId: string, profileId?: string): Promise<boolean>;
}
