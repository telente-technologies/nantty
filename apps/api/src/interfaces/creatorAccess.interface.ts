export interface CreatorAccess {
  assertApprovedCreator(userId: string): Promise<void>;
}
