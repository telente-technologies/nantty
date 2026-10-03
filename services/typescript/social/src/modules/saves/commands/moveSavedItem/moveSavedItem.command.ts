export interface MoveSavedItemCommand {
  readonly userId: string;
  readonly saveId: string;
  readonly collectionId: string | null;
}
