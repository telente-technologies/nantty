import type { HttpRouterContext } from "@zudojs/http";
import { schema } from "@zudojs/schema";

import { maximumQueryLength } from "../../../constants/search.constant.js";
import { badRequest } from "../../../errors/search.error.js";
import type { RecentSearchStore } from "../../../interfaces/searchStore.interface.js";
import { requireViewerId } from "../../../middlewares/principal.middleware.js";
import { empty, errorToResponse, json, parseJsonBody } from "../../../utils/http.util.js";
import { normalizeSearchText } from "../../../utils/queryNormalizer.util.js";

const recordBodySchema = schema.object({ q: schema.string().min(1).max(maximumQueryLength) });
const identifierSchema = schema.string().uuid();
const recentListLimit = 20;

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
    list: guarded(async (_context, viewerId) => json(200, { data: await store.list(viewerId, recentListLimit), nextCursor: null })),
    record: guarded(async (context, viewerId) => {
      const body = recordBodySchema.safeParse(parseJsonBody(context.request.body));
      if (!body.success) throw badRequest("VALIDATION_FAILED", "q is required.");
      const normalized = normalizeSearchText(body.data.q);
      if (normalized === "") throw badRequest("VALIDATION_FAILED", "q is required.");
      await store.record(viewerId, normalized, body.data.q.trim());
      return empty(204);
    }),
    remove: guarded(async (context, viewerId) => {
      const id = identifierSchema.safeParse(context.params["id"]);
      if (!id.success) throw badRequest("VALIDATION_FAILED", "id must be a uuid.");
      await store.remove(viewerId, id.data);
      return empty(204);
    }),
    clear: guarded(async (_context, viewerId) => {
      await store.clear(viewerId);
      return empty(204);
    }),
  };
}
