import type { SearchResults } from "@/types/commerce.type";

import { sendRequestToWebappServer } from "./clientApi.service";

export type SearchScope = "all" | "products" | "stores" | "brands" | "people";

export const searchService = {
  searchProductsStoresAndPeople: (query: string, scope: SearchScope) =>
    sendRequestToWebappServer<SearchResults>("/api/v1/search", { query: { q: query, scope } }),
};
