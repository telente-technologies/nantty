import type { PostNotificationScope } from "../../models/postNotifications.model.js";

export interface ListPostNotificationSubscribersQuery {
  readonly authorId: string;
  readonly scope: PostNotificationScope;
  readonly cursor: string | undefined;
  readonly limit: number;
  readonly postId?: string | undefined;
}
