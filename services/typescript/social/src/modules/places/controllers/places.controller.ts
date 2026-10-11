import type { Handler } from "../../../types/handlerContext.type.js";
import type { RouteFactory } from "../../../utils/route.util.js";
import type { SearchPlacesResponse } from "../queries/searchPlaces/searchPlaces.handler.js";
import type { SearchPlacesQuery } from "../queries/searchPlaces/searchPlaces.query.js";
import { searchPlacesQuerySchema } from "../validators/places.validator.js";

export interface PlacesHandlers {
  readonly searchPlaces: Handler<SearchPlacesQuery, SearchPlacesResponse>;
}

export function createPlacesController(route: RouteFactory, handlers: PlacesHandlers) {
  return {
    search: route({ authentication: "required", query: searchPlacesQuerySchema }, ({ query }) => handlers.searchPlaces({ text: query.q })),
  };
}
