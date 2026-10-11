export interface PlaceSuggestion {
  readonly placeId: string;
  readonly name: string;
  readonly area: string | null;
}

export interface PlacesProvider {
  searchPlacesByName(term: string, limit: number): Promise<readonly PlaceSuggestion[]>;
}
