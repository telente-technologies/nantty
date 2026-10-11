export type PostNotificationScope = "posts" | "lives";

export interface PostNotificationSubscriberSource {
  listPage(authorId: string, scope: PostNotificationScope, cursor: string | null, limit: number, postId?: string): Promise<{ readonly data: readonly { readonly userId: string }[]; readonly nextCursor: string | null }>;
}
