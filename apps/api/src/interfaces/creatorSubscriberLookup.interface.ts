export type ContentVisibility = "public" | "subscribers";

export interface CreatorSubscriberLookup {
  listCreatorIdsViewerSubscribesTo(viewerId: string, creatorIds: readonly string[]): Promise<ReadonlySet<string>>;
}
