import type { HttpRouter } from "@zudojs/http";

import type { WebKit } from "../../../loaders/web.loader.js";
import { describeRoute } from "../../../utils/openapi.util.js";
import type { CartsController } from "../controllers/carts.controller.js";
import { AddCartItemBodySchema, CartItemParamsSchema, UpdateCartItemBodySchema } from "../validators/carts.validator.js";

const BASE_PATH = "/api/v1/cart";
const TAG = "cart";

export function registerCartsRoutes(router: HttpRouter, controller: CartsController, web: WebKit): void {
  const cart = web.guard.requirePermission("cart:manage");
  router.get(BASE_PATH, controller.getCart, { ...cart, ...describeRoute(TAG, "Get my cart with server-computed totals") });
  router.delete(BASE_PATH, controller.clear, { ...cart, ...describeRoute(TAG, "Empty my cart") });
  router.post(`${BASE_PATH}/items`, controller.addItem, { ...cart, ...describeRoute(TAG, "Add a product variant to my cart", { body: AddCartItemBodySchema }) });
  router.patch(`${BASE_PATH}/items/:variantId`, controller.updateItem, { ...cart, ...describeRoute(TAG, "Change a cart item quantity", { params: CartItemParamsSchema, body: UpdateCartItemBodySchema }) });
  router.delete(`${BASE_PATH}/items/:variantId`, controller.removeItem, { ...cart, ...describeRoute(TAG, "Remove a cart item", { params: CartItemParamsSchema }) });
}
