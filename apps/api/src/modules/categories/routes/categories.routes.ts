import type { HttpRouter } from "@zudojs/http";

import type { WebKit } from "../../../loaders/web.loader.js";
import { describeRoute } from "../../../utils/openapi.util.js";
import type { CategoriesController } from "../controllers/categories.controller.js";
import { CategoryParamsSchema, CreateCategoryBodySchema, UpdateCategoryBodySchema } from "../validators/categories.validator.js";

const BASE_PATH = "/api/v1/categories";
const TAG = "categories";

export function registerCategoriesRoutes(router: HttpRouter, controller: CategoriesController, web: WebKit): void {
  const { guard } = web;
  const admin = guard.requirePermission("categories:manage");
  router.get(BASE_PATH, controller.list, { ...guard.allowAnyone(), ...describeRoute(TAG, "List categories") });
  router.get(`${BASE_PATH}/:id`, controller.get, { ...guard.allowAnyone(), ...describeRoute(TAG, "Get a category", { params: CategoryParamsSchema }) });
  router.post(BASE_PATH, controller.create, { ...admin, ...describeRoute(TAG, "Create a category", { body: CreateCategoryBodySchema }) });
  router.patch(`${BASE_PATH}/:id`, controller.update, { ...admin, ...describeRoute(TAG, "Update a category", { params: CategoryParamsSchema, body: UpdateCategoryBodySchema }) });
  router.delete(`${BASE_PATH}/:id`, controller.remove, { ...admin, ...describeRoute(TAG, "Delete a category", { params: CategoryParamsSchema }) });
}
