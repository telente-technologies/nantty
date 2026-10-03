export interface PremiumEntitlements {
  isPremium(accountId: string): Promise<boolean>;
  hasSubscribedToCreator(viewerId: string, creatorId: string): Promise<boolean>;
}
