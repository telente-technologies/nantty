import { publishedPostToViewers } from "../../../../constants/moderation.constant.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { blockRepository } from "../../../blocks/repositories/block.repository.js";
import { followRepository } from "../../../follows/repositories/follow.repository.js";
import type { PostNotificationSubscriber } from "../../models/postNotifications.model.js";
import { levelsForScope } from "../../services/postNotificationRules.service.js";
import type { ListPostNotificationSubscribersQuery } from "./listPostNotificationSubscribers.query.js";

export interface SubscriberPage {
  readonly data: readonly PostNotificationSubscriber[];
  readonly nextCursor: string | null;
}

export function createListPostNotificationSubscribersHandler(context: HandlerContext): Handler<ListPostNotificationSubscribersQuery, SubscriberPage> {
  return async ({ authorId, scope, cursor, limit, postId }) => {
    const db = context.database.client;
    if (postId !== undefined && (await db.post.count({ where: { id: postId, authorId, ...publishedPostToViewers } })) === 0) return { data: [], nextCursor: null };
    const rows = await followRepository.pagePostNotificationSubscribers(db, authorId, levelsForScope(scope), limit, cursor);
    const page = rows.slice(0, limit);
    const candidateIds = page.map((row) => row.followerId).filter((id) => id !== authorId);
    const [blockedByAuthor, blockingAuthor] = candidateIds.length === 0
      ? [new Set<string>(), new Set<string>()]
      : await Promise.all([blockRepository.blockedByViewer(db, authorId, candidateIds), blockRepository.blockersOfViewer(db, authorId, candidateIds)]);
    const data = candidateIds.filter((id) => !blockedByAuthor.has(id) && !blockingAuthor.has(id)).map((userId) => ({ userId }));
    return { data, nextCursor: rows.length > limit ? (page[page.length - 1]?.id ?? null) : null };
  };
}
