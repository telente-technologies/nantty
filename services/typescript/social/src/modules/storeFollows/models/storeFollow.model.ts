export interface StoreFollowState {
  readonly storeId: string;
  readonly isFollowing: boolean;
  readonly followers: number;
}

export interface FollowedStoreEntry {
  readonly id: string;
  readonly kind: "store";
  readonly name: string;
  readonly username: string;
  readonly avatarUrl: string | null;
  readonly verified: boolean;
  readonly isCreator: boolean;
  readonly isFollowing: boolean;
  readonly followedAt: string;
}
