export type PostNotificationScope = "posts" | "lives";

export interface PostNotificationSubscriberSource {
  listPage(authorId: string, scope: PostNotificationScope, cursor: string | null, limit: number): Promise<{ readonly data: readonly { readonly userId: string }[]; readonly nextCursor: string | null }>;
}
