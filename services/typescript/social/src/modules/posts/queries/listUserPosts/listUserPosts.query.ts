export interface ListUserPostsQuery {
  readonly viewerId: string | undefined;
  readonly ownerId: string;
  readonly cursor: string | undefined;
  readonly limit: number;
  readonly kind: "post" | "clip" | undefined;
  readonly visibility?: "public" | "subscribers";
}
