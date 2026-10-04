export type EngagementSource = "any_post" | "clips_watched" | "messaged";

export interface ListAudienceEngagersQuery {
  readonly accountId: string;
  readonly source: EngagementSource;
  readonly since: Date;
  readonly cursor: string | undefined;
  readonly limit: number;
}
