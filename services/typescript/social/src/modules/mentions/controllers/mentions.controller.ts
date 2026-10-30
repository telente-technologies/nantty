import type { Handler } from "../../../types/handlerContext.type.js";
import type { RouteFactory } from "../../../utils/route.util.js";
import type { ListMentionCandidatesQuery } from "../queries/listMentionCandidates/listMentionCandidates.query.js";
import type { MentionCandidatesResponse } from "../queries/listMentionCandidates/listMentionCandidates.handler.js";
import type { MentionTargetsByUserId } from "../queries/resolveMentionTargets/resolveMentionTargets.handler.js";
import type { ResolveMentionTargetsQuery } from "../queries/resolveMentionTargets/resolveMentionTargets.query.js";
import { candidatesQuerySchema, resolveBodySchema } from "../validators/mentions.validator.js";

export interface MentionsHandlers {
  readonly listMentionCandidates: Handler<ListMentionCandidatesQuery, MentionCandidatesResponse>;
  readonly resolveMentionTargets: Handler<ResolveMentionTargetsQuery, MentionTargetsByUserId>;
}

export function createMentionsController(route: RouteFactory, handlers: MentionsHandlers) {
  return {
    candidates: route({ authentication: "required", query: candidatesQuerySchema }, ({ principal, query }) =>
      handlers.listMentionCandidates({ viewerId: principal.accountId, surface: query.surface, term: query.q ?? "", conversationId: query.conversationId })),
    // Resolving account IDs to usernames/statuses enables client-side mention
    // rendering. Keep it authenticated; the gateway applies the existing
    // account-scoped mentionsResolve rate limit to this route.
    resolve: route({ authentication: "required", body: resolveBodySchema }, ({ body }) => handlers.resolveMentionTargets({ userIds: body.userIds })),
  };
}
