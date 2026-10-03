export interface SearchPeopleQuery {
  readonly viewerId: string | undefined;
  readonly term: string;
  readonly cursor: string | undefined;
  readonly limit: number;
}
