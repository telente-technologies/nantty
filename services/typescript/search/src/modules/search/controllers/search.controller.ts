import type { HttpResponseContext, HttpRouterContext } from "@zudojs/http";
import type { Schema } from "@zudojs/schema";

import { errorToResponse, json, validationFailed } from "../../../utils/http.util.js";
import { clampPageSize } from "../../../utils/cursor.util.js";
import { findClientRegion, findViewerId } from "../../../middlewares/principal.middleware.js";
import type { SearchQueryService } from "../services/searchQuery.service.js";
import { searchQuerySchema, suggestQuerySchema } from "../validators/search.validator.js";

export function parseQuery<T>(schemaDefinition: Schema<T>, context: HttpRouterContext): { readonly ok: true; readonly data: T } | { readonly ok: false; readonly response: HttpResponseContext } {
  const flattened = Object.fromEntries(Object.entries(context.query).map(([key, value]) => [key, Array.isArray(value) ? (value[0] ?? "") : value]));
  const result = schemaDefinition.safeParse(flattened);
  return result.success ? { ok: true, data: result.data } : { ok: false, response: validationFailed(result.issues) };
}

export function createSearchController(service: SearchQueryService) {
  return {
    search: async (context: HttpRouterContext) => {
      const parsed = parseQuery(searchQuerySchema, context);
      if (!parsed.ok) return parsed.response;
      const { q, scope = "top", cursor, limit } = parsed.data;
      const viewerId = findViewerId(context);
      const region = findClientRegion(context);
      try {
        if (scope === "all") return json(200, await service.searchGrouped(viewerId, q, region));
        return json(200, await service.search({ viewerId, query: q, scope, cursor, limit: clampPageSize(limit), region }));
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
