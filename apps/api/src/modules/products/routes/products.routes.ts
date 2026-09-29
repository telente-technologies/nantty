import type { HttpRouter } from "@zudojs/http";

import type { WebKit } from "../../../loaders/web.loader.js";
import { describeRoute } from "../../../utils/openapi.util.js";
import type { ProductsController } from "../controllers/products.controller.js";
import type { SellerProductsController } from "../controllers/sellerProducts.controller.js";
import {
  AdjustInventoryBodySchema,
  CreateProductBodySchema,
  ListProductsQuerySchema,
  ProductParamsSchema,
  SellerProductPageQuerySchema,
  SellerProductParamsSchema,
  SellerScopeQuerySchema,
  SellerVariantParamsSchema,
  StorePageQuerySchema,
  StoreParamsSchema,
  UpdateProductBodySchema,
  UpdateVariantBodySchema,
  VariantBodySchema,
} from "../validators/products.validator.js";

const SELLER_PRODUCTS = "/api/v1/seller/products";
const TAG = "products";

export function registerProductsRoutes(router: HttpRouter, controller: ProductsController, sellerController: SellerProductsController, web: WebKit): void {
  const { guard } = web;
  const seller = guard.requirePermission("products:manage");
  const anyone = guard.allowAnyone();
  const shopper = guard.requirePermission("social:write");

  router.get("/api/v1/products", controller.list, { ...anyone, ...describeRoute(TAG, "Browse products", { query: ListProductsQuerySchema }) });
  router.get("/api/v1/products/featured", controller.listFeatured, { ...anyone, ...describeRoute(TAG, "Featured products") });
  router.get("/api/v1/products/:id", controller.get, { ...anyone, ...describeRoute(TAG, "Get a product", { params: ProductParamsSchema }) });
  router.post("/api/v1/products/:id/like", controller.like, { ...shopper, ...describeRoute(TAG, "Like a product", { params: ProductParamsSchema }) });
  router.delete("/api/v1/products/:id/like", controller.unlike, { ...shopper, ...describeRoute(TAG, "Unlike a product", { params: ProductParamsSchema }) });
  router.post("/api/v1/products/:id/bookmark", controller.bookmark, { ...shopper, ...describeRoute(TAG, "Bookmark a product", { params: ProductParamsSchema }) });
  router.delete("/api/v1/products/:id/bookmark", controller.removeBookmark, { ...shopper, ...describeRoute(TAG, "Remove a product bookmark", { params: ProductParamsSchema }) });
  router.get("/api/v1/stores/:storeId/products", controller.listForPublicStore, { ...anyone, ...describeRoute(TAG, "List a store's products", { params: StoreParamsSchema, query: StorePageQuerySchema }) });
  router.get("/api/v1/mart/home", controller.martHome, { ...anyone, ...describeRoute(TAG, "Mart home banners, tiles and categories") });

  router.get(SELLER_PRODUCTS, sellerController.list, { ...seller, ...describeRoute(TAG, "List my store's products", { query: SellerProductPageQuerySchema }) });
  router.post(SELLER_PRODUCTS, sellerController.create, { ...seller, ...describeRoute(TAG, "Create a product", { query: SellerScopeQuerySchema, body: CreateProductBodySchema }) });
  router.get("/api/v1/seller/inventory", sellerController.inventory, { ...seller, ...describeRoute(TAG, "List my store's inventory", { query: SellerScopeQuerySchema }) });
  router.get(`${SELLER_PRODUCTS}/:id`, sellerController.get, { ...seller, ...describeRoute(TAG, "Get one of my products", { params: SellerProductParamsSchema }) });
  router.patch(`${SELLER_PRODUCTS}/:id`, sellerController.update, { ...seller, ...describeRoute(TAG, "Update a product", { params: SellerProductParamsSchema, body: UpdateProductBodySchema }) });
  router.delete(`${SELLER_PRODUCTS}/:id`, sellerController.remove, { ...seller, ...describeRoute(TAG, "Archive a product", { params: SellerProductParamsSchema }) });
  router.post(`${SELLER_PRODUCTS}/:id/publish`, sellerController.publish, { ...seller, ...describeRoute(TAG, "Publish a product", { params: SellerProductParamsSchema }) });
  router.post(`${SELLER_PRODUCTS}/:id/unpublish`, sellerController.unpublish, { ...seller, ...describeRoute(TAG, "Unpublish a product", { params: SellerProductParamsSchema }) });
  router.post(`${SELLER_PRODUCTS}/:id/variants`, sellerController.addVariant, { ...seller, ...describeRoute(TAG, "Add a variant", { params: SellerProductParamsSchema, body: VariantBodySchema }) });
  router.patch(`${SELLER_PRODUCTS}/:id/variants/:variantId`, sellerController.updateVariant, {
    ...seller,
    ...describeRoute(TAG, "Update a variant", { params: SellerVariantParamsSchema, body: UpdateVariantBodySchema }),
  });
  router.post(`${SELLER_PRODUCTS}/:id/variants/:variantId/inventory`, sellerController.adjustInventory, {
    ...seller,
    ...describeRoute(TAG, "Adjust a variant's stock", { params: SellerVariantParamsSchema, body: AdjustInventoryBodySchema }),
  });
}
