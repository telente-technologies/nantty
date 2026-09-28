import type { SearchResults } from "@/types/commerce.type";

import { api } from "./api-client.service";

export type SearchScope = "all" | "products" | "stores" | "people";

export const searchService = {
  searchProductsStoresAndPeople: (query: string, scope: SearchScope) => api.get<SearchResults>("/api/v1/search", { q: query, scope }),
};
