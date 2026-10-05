import type { Category } from "@/types";

import { sendListRequestToWebappServer } from "./clientApi.service";

export const categoriesService = {
  fetchProductCategories: () => sendListRequestToWebappServer<Category>("/api/v1/categories"),
};
