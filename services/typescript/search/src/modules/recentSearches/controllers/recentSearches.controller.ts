import type { HttpRouterContext } from "@nantty/fastify-platform";
import { schema } from "@nantty/fastify-platform";

import { maximumQueryLength, maximumScopeLength } from "../../../constants/search.constant.js";
import { badRequest } from "../../../errors/search.error.js";
import type { RecentSearchStore } from "../../../interfaces/searchStore.interface.js";
import { requireViewerId } from "../../../middlewares/principal.middleware.js";
import { empty, errorToResponse, json, parseJsonBody } from "../../../utils/http.util.js";
import { normalizeSearchText } from "../../../utils/queryNormalizer.util.js";
import { formatSearchScope, parseSearchScope } from "../../../utils/searchScope.util.js";

const recordBodySchema = schema.object({ q: schema.string().min(1).max(maximumQueryLength), scope: schema.string().max(maximumScopeLength).optional() });
const identifierSchema = schema.string().uuid();
const recentListLimit = 20;

function readScopeKey(raw: unknown): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const valid = value === undefined || (typeof value === "string" && value.length <= maximumScopeLength);
  const scope = valid ? parseSearchScope(value) : null;
  if (scope === null) throw badRequest("VALIDATION_FAILED", "scope must be global, mart, store:<id> or profile:<id>.");
  return formatSearchScope(scope);
}

export function createRecentSearchesController(store: RecentSearchStore) {
  const guarded = (action: (context: HttpRouterContext, viewerId: string) => Promise<ReturnType<typeof json>>) => async (context: HttpRouterContext) => {
    try {
      return await action(context, requireViewerId(context));
    } catch (error) {
      const response = errorToResponse(error);
      if (response === undefined) throw error;
      return response;
    }
  };
  return {
    list: guarded(async (context, viewerId) => json(200, { data: await store.list(viewerId, readScopeKey(context.query["scope"]), recentListLimit), nextCursor: null })),
    record: guarded(async (context, viewerId) => {
      const body = recordBodySchema.safeParse(parseJsonBody(context.request.body));
      if (!body.success) throw badRequest("VALIDATION_FAILED", "q is required.");
      const normalized = normalizeSearchText(body.data.q);
      if (normalized === "") throw badRequest("VALIDATION_FAILED", "q is required.");
      await store.record(viewerId, readScopeKey(body.data.scope), normalized, body.data.q.trim());
      return empty(204);
    }),
    remove: guarded(async (context, viewerId) => {
      const id = identifierSchema.safeParse(context.params["id"]);
      if (!id.success) throw badRequest("VALIDATION_FAILED", "id must be a uuid.");
      await store.remove(viewerId, id.data);
      return empty(204);
    }),
    clear: guarded(async (context, viewerId) => {
      await store.clear(viewerId, context.query["scope"] === undefined ? undefined : readScopeKey(context.query["scope"]));
      return empty(204);
    }),
  };
}
