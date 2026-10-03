import type { MentionTargetStatus } from "../../../../interfaces/identityDirectory.interface.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { ResolveMentionTargetsQuery } from "./resolveMentionTargets.query.js";

export type MentionTargetsByUserId = Readonly<Record<string, { readonly username: string | null; readonly status: MentionTargetStatus }>>;

export function createResolveMentionTargetsHandler(context: HandlerContext): Handler<ResolveMentionTargetsQuery, MentionTargetsByUserId> {
  return async ({ userIds }) => {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const valid = userIds.filter((id) => uuid.test(id));
    const statuses = await context.directory.findMentionTargetStatuses(valid);
    return Object.fromEntries(userIds.map((id) => [id, statuses.get(id) ?? { username: null, status: "deleted" as const }]));
  };
}
