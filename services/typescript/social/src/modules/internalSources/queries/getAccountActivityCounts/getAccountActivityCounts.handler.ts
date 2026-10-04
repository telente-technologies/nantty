import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { GetAccountActivityCountsQuery } from "./getAccountActivityCounts.query.js";

export function createGetAccountActivityCountsHandler(context: HandlerContext): Handler<GetAccountActivityCountsQuery, { readonly posts: number }> {
  return async ({ accountId, sinceDays }) => {
    const since = new Date(context.clock.now().getTime() - sinceDays * 86_400_000);
    const posts = await context.database.client.post.count({ where: { authorId: accountId, deletedAt: null, createdAt: { gte: since } } });
    return { posts };
  };
}
