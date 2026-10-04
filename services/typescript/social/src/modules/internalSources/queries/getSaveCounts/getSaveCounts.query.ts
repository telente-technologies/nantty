export interface GetSaveCountsQuery {
  readonly type: "post" | "video" | "clip" | "product";
  readonly targetIds: readonly string[];
}
