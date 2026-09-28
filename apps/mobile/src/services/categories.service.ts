import type { Category } from "@/types";

import { api } from "./api-client.service";

export const categoriesService = {
  fetchProductCategories: () => api.get<Category[]>("/api/v1/categories"),
};
