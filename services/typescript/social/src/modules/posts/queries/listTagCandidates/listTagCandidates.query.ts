export interface ListTagCandidatesQuery {
  readonly viewerId: string;
  readonly term: string;
  readonly cursor: string | undefined;
  readonly limit: number;
}
