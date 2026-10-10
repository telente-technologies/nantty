import type { Category } from "@/types";

import { api } from "../core/apiClient.service";

export const categoriesService = {
  fetchProductCategories: () => api.getList<Category>("/api/v1/categories"),
};
