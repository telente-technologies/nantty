import type { PostLocationTag } from "@/types";

import { sendRequestToWebappServer } from "./clientApi.service";

export const placesService = {
  searchPlaces: async (text: string): Promise<readonly PostLocationTag[]> =>
    (await sendRequestToWebappServer<{ readonly places: readonly PostLocationTag[] }>("/api/v1/places/search", { query: { q: text } })).places,
};
