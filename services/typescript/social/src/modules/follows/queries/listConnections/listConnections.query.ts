export type ConnectionTab = "followers" | "following" | "shopped" | "suggested" | "blocked";

export interface ListConnectionsQuery {
  readonly viewerId: string | undefined;
  readonly ownerId: string;
  readonly tab: ConnectionTab;
  readonly searchTerm: string | undefined;
  readonly cursor: string | undefined;
  readonly limit: number;
}
