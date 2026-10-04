export interface ListAdContentSourcesQuery {
  readonly ownerUserId: string;
  readonly type: "post" | "clip" | "product" | "live" | "store" | undefined;
  readonly search: string | undefined;
  readonly cursor: string | undefined;
  readonly limit: number;
}
