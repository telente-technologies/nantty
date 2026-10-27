import type { HttpResponseContext, HttpRouterContext } from "@nantty/fastify-platform";
import type { Schema } from "@nantty/fastify-platform";

import { errorToResponse, json, validationFailed } from "../../../utils/http.util.js";
import { clampPageSize } from "../../../utils/cursor.util.js";
import { resolveScopeAndType } from "../../../utils/searchScope.util.js";
import { findClientRegion, findViewerId, isViewerVerifiedAdult } from "../../../middlewares/principal.middleware.js";
import type { SearchQueryService } from "../services/searchQuery.service.js";
import { searchQuerySchema, suggestQuerySchema } from "../validators/search.validator.js";

export function parseQuery<T>(schemaDefinition: Schema<T>, context: HttpRouterContext): { readonly ok: true; readonly data: T } | { readonly ok: false; readonly response: HttpResponseContext } {
  const flattened = Object.fromEntries(Object.entries(context.query).map(([key, value]) => [key, Array.isArray(value) ? (value[0] ?? "") : value]));
  const result = schemaDefinition.safeParse(flattened);
  return result.success ? { ok: true, data: result.data } : { ok: false, response: validationFailed(result.error.issues) };
}

const invalidScope = () => validationFailed([{ code: "invalid_scope", path: ["scope"], message: "scope must be global, mart, store:<id> or profile:<id>." }]);

export function createSearchController(service: SearchQueryService) {
  return {
    search: async (context: HttpRouterContext) => {
      const parsed = parseQuery(searchQuerySchema, context);
      if (!parsed.ok) return parsed.response;
      const { q, cursor, limit } = parsed.data;
      const resolved = resolveScopeAndType(parsed.data.scope, parsed.data.type);
      if (resolved === null) return invalidScope();
      const viewerId = findViewerId(context);
      const region = findClientRegion(context);
      try {
        if (resolved.type === "all") return json(200, await service.searchGrouped(viewerId, q, region));
        return json(200, await service.search({ viewerId, query: q, scope: resolved.scope, type: resolved.type, cursor, limit: clampPageSize(limit), region, viewerIsAdult: isViewerVerifiedAdult(context) }));
      } catch (error) {
        return errorToResponse(error) ?? json(500, { message: "Internal Server Error", code: "INTERNAL_ERROR" });
      }
    },
    suggest: async (context: HttpRouterContext) => {
      const parsed = parseQuery(suggestQuerySchema, context);
      if (!parsed.ok) return parsed.response;
      return json(200, { data: await service.suggest(findViewerId(context), parsed.data.q) });
    },
  };
}
