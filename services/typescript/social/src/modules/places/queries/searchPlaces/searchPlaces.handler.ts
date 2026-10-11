import type { PlaceSuggestion, PlacesProvider } from "../../../../interfaces/placesProvider.interface.js";
import type { Handler } from "../../../../types/handlerContext.type.js";
import { buildFreeTextPlace, normalisePlaceSearchText } from "../../services/bundledPlaces.service.js";
import type { SearchPlacesQuery } from "./searchPlaces.query.js";

export interface SearchPlacesResponse {
  readonly places: readonly PlaceSuggestion[];
}

const MAXIMUM_PLACE_RESULTS = 15;

export function createSearchPlacesHandler(provider: PlacesProvider): Handler<SearchPlacesQuery, SearchPlacesResponse> {
  return async ({ text }) => {
    const matches = await provider.searchPlacesByName(text, MAXIMUM_PLACE_RESULTS);
    const freeText = buildFreeTextPlace(text);
    const typedTextAlreadyListed = matches.some((place) => normalisePlaceSearchText(place.name) === normalisePlaceSearchText(text));
    return { places: freeText && !typedTextAlreadyListed ? [...matches, freeText] : matches };
  };
}
