import type { Category } from "@/types";

import { sendRequestToWebappServer } from "./clientApi.service";

export const categoriesService = {
  fetchProductCategories: () => sendRequestToWebappServer<Category[]>("/api/v1/categories"),
};
