import { BUNDLED_COUNTRY_PLACES } from "../../../constants/bundledPlaces.constant.js";
import type { PlaceSuggestion, PlacesProvider } from "../../../interfaces/placesProvider.interface.js";

interface IndexedPlace extends PlaceSuggestion {
  readonly searchableName: string;
}

export function normalisePlaceSearchText(text: string): string {
  return text.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

const slugFromText = (text: string) => normalisePlaceSearchText(text).replace(/ /g, "-");

const INDEXED_BUNDLED_PLACES: readonly IndexedPlace[] = BUNDLED_COUNTRY_PLACES.flatMap((country) =>
  country.places.map(([name, region]) => ({
    placeId: `zm:${country.countryCode.toLowerCase()}:${slugFromText(region)}:${slugFromText(name)}`,
    name,
    area: region === name ? country.countryName : `${region}, ${country.countryName}`,
    searchableName: normalisePlaceSearchText(name),
  })),
);

function rankPlaceAgainstTerm(place: IndexedPlace, term: string): number {
  if (place.searchableName === term) return 0;
  if (place.searchableName.startsWith(term)) return 1;
  if (place.searchableName.split(" ").some((word) => word.startsWith(term))) return 2;
  if (normalisePlaceSearchText(place.area ?? "").split(" ").some((word) => word.startsWith(term))) return 3;
  return -1;
}

export function createBundledPlacesProvider(): PlacesProvider {
  return {
    searchPlacesByName: async (term, limit) => {
      const normalisedTerm = normalisePlaceSearchText(term);
      if (normalisedTerm.length < 2) return [];
      return INDEXED_BUNDLED_PLACES
        .map((place) => ({ place, rank: rankPlaceAgainstTerm(place, normalisedTerm) }))
        .filter((candidate) => candidate.rank >= 0)
        .sort((left, right) => left.rank - right.rank || left.place.name.localeCompare(right.place.name))
        .slice(0, limit)
        .map(({ place }) => ({ placeId: place.placeId, name: place.name, area: place.area }));
    },
  };
}

export function buildFreeTextPlace(typedText: string): PlaceSuggestion | null {
  const name = typedText.replace(/\s+/g, " ").trim().slice(0, 120);
  const slug = slugFromText(name);
  if (slug.length < 2) return null;
  return { placeId: `text:${slug}`.slice(0, 200), name, area: null };
}
