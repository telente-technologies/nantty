import type { HttpRouter } from "@zudojs/http";

import type { WebKit } from "../../../loaders/web.loader.js";
import { describeRoute } from "../../../utils/openapi.util.js";
import type { ProductsController } from "../controllers/products.controller.js";
import {
  AdjustInventoryBodySchema,
  CreateProductBodySchema,
  ListProductsQuerySchema,
  ProductParamsSchema,
  StorePageQuerySchema,
  StoreParamsSchema,
  StoreProductParamsSchema,
  StoreVariantParamsSchema,
  UpdateProductBodySchema,
  UpdateVariantBodySchema,
  VariantBodySchema,
} from "../validators/products.validator.js";

const STORE_PRODUCTS = "/api/v1/stores/:storeId/products";
const TAG = "products";

export function registerProductsRoutes(router: HttpRouter, controller: ProductsController, web: WebKit): void {
  const { guard } = web;
  const seller = guard.requirePermission("products:manage");
  const anyone = guard.allowAnyone();

  router.get("/api/v1/products", controller.list, { ...anyone, ...describeRoute(TAG, "Browse products", { query: ListProductsQuerySchema }) });
  router.get("/api/v1/products/:id", controller.get, { ...anyone, ...describeRoute(TAG, "Get a product", { params: ProductParamsSchema }) });
  router.get("/api/v1/mart/home", controller.martHome, { ...anyone, ...describeRoute(TAG, "Mart home sections") });
  router.get(STORE_PRODUCTS, controller.listForStore, { ...seller, ...describeRoute(TAG, "List a store's products", { params: StoreParamsSchema, query: StorePageQuerySchema }) });
  router.get("/api/v1/stores/:storeId/inventory", controller.inventory, { ...seller, ...describeRoute(TAG, "List a store's inventory", { params: StoreParamsSchema }) });
  router.post(STORE_PRODUCTS, controller.create, { ...seller, ...describeRoute(TAG, "Create a product", { params: StoreParamsSchema, body: CreateProductBodySchema }) });
  router.patch(`${STORE_PRODUCTS}/:productId`, controller.update, { ...seller, ...describeRoute(TAG, "Update a product", { params: StoreProductParamsSchema, body: UpdateProductBodySchema }) });
  router.delete(`${STORE_PRODUCTS}/:productId`, controller.remove, { ...seller, ...describeRoute(TAG, "Archive a product", { params: StoreProductParamsSchema }) });
  router.post(`${STORE_PRODUCTS}/:productId/publish`, controller.publish, { ...seller, ...describeRoute(TAG, "Publish a product", { params: StoreProductParamsSchema }) });
  router.post(`${STORE_PRODUCTS}/:productId/unpublish`, controller.unpublish, { ...seller, ...describeRoute(TAG, "Unpublish a product", { params: StoreProductParamsSchema }) });
  router.post(`${STORE_PRODUCTS}/:productId/variants`, controller.addVariant, { ...seller, ...describeRoute(TAG, "Add a variant", { params: StoreProductParamsSchema, body: VariantBodySchema }) });
  router.patch(`${STORE_PRODUCTS}/:productId/variants/:variantId`, controller.updateVariant, {
    ...seller,
    ...describeRoute(TAG, "Update a variant", { params: StoreVariantParamsSchema, body: UpdateVariantBodySchema }),
  });
  router.post(`${STORE_PRODUCTS}/:productId/variants/:variantId/inventory`, controller.adjustInventory, {
    ...seller,
    ...describeRoute(TAG, "Adjust a variant's stock", { params: StoreVariantParamsSchema, body: AdjustInventoryBodySchema }),
  });
}
