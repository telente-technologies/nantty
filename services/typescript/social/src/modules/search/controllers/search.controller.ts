import type { Handler } from "../../../types/handlerContext.type.js";
import type { Page } from "../../../types/pagination.type.js";
import { clampPageSize } from "../../../utils/cursor.util.js";
import type { RouteFactory } from "../../../utils/route.util.js";
import type { ConnectionEntry } from "../../follows/models/follow.model.js";
import type { SearchPeopleQuery } from "../queries/searchPeople/searchPeople.query.js";
import { searchPeopleQuerySchema } from "../validators/search.validator.js";

export interface SearchHandlers {
  readonly searchPeople: Handler<SearchPeopleQuery, Page<ConnectionEntry>>;
}

export function createSearchController(route: RouteFactory, handlers: SearchHandlers) {
  return {
    people: route({ authentication: "optional", query: searchPeopleQuerySchema }, ({ principal, query }) =>
      handlers.searchPeople({ viewerId: principal?.accountId, term: query.q, cursor: query.cursor, limit: clampPageSize(query.limit, 20) })),
  };
}
