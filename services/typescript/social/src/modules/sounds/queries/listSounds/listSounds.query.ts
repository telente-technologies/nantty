export interface ListSoundsQuery {
  readonly viewerId: string | undefined;
  readonly scope: "search" | "trending" | "saved";
  readonly term: string;
  readonly cursor: string | undefined;
  readonly limit: number;
}
