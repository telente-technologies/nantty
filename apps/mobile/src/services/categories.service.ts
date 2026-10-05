import type { Category } from "@/types";

import { api } from "./apiClient.service";

export const categoriesService = {
  fetchProductCategories: () => api.getList<Category>("/api/v1/categories"),
};
