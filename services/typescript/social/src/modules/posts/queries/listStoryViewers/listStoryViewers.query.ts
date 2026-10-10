export interface ListStoryViewersQuery {
  readonly viewerId: string;
  readonly storyId: string;
  readonly cursor: string | undefined;
  readonly limit: number;
}
