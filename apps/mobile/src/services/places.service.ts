import type { PostLocationTag } from "@/types";

import { api } from "./apiClient.service";

export const placesService = {
  searchPlaces: async (text: string): Promise<readonly PostLocationTag[]> =>
    (await api.get<{ places: readonly PostLocationTag[] }>("/api/v1/places/search", { q: text })).places,
};
