export interface StoreInboxTeam {
  memberAccountIds(storeId: string): Promise<readonly string[]>;
  forget?(storeId: string): void;
}
