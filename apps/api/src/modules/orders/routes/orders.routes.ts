import type { HttpRouter } from "@zudojs/http";

import type { WebKit } from "../../../loaders/web.loader.js";
import { describeRoute } from "../../../utils/openapi.util.js";
import type { OrdersController } from "../controllers/orders.controller.js";
import {
  CheckoutBodySchema,
  ListBuyerOrdersQuerySchema,
  ListStoreOrdersQuerySchema,
  OrderParamsSchema,
  ShipOrderBodySchema,
  StoreOrderParamsSchema,
  StoreParamsSchema,
} from "../validators/orders.validator.js";

const TAG = "orders";
const STORE_ORDERS = "/api/v1/stores/:storeId/orders";

export function registerOrdersRoutes(router: HttpRouter, controller: OrdersController, web: WebKit): void {
  const { guard, requireIdempotencyKey } = web;
  const buyer = guard.requirePermission("orders:read-own");
  const seller = guard.requirePermission("orders:fulfil");

  router.post("/api/v1/checkout", controller.checkout, {
    ...guard.requirePermission("orders:place", requireIdempotencyKey),
    ...describeRoute(TAG, "Create per-store orders from my cart (Idempotency-Key required)", { body: CheckoutBodySchema }),
  });
  router.get("/api/v1/orders", controller.listMine, { ...buyer, ...describeRoute(TAG, "List my orders", { query: ListBuyerOrdersQuerySchema }) });
  router.get("/api/v1/orders/:id", controller.getMine, { ...buyer, ...describeRoute(TAG, "Get one of my orders", { params: OrderParamsSchema }) });
  router.post("/api/v1/orders/:id/cancel", controller.cancel, { ...buyer, ...describeRoute(TAG, "Cancel an unpaid order", { params: OrderParamsSchema }) });
  router.post("/api/v1/orders/:id/confirm-receipt", controller.confirmReceipt, {
    ...guard.requirePermission("orders:read-own", requireIdempotencyKey),
    ...describeRoute(TAG, "Confirm delivery and release escrow (Idempotency-Key required)", { params: OrderParamsSchema }),
  });
  router.get(STORE_ORDERS, controller.listStoreOrders, { ...seller, ...describeRoute(TAG, "List a store's orders", { params: StoreParamsSchema, query: ListStoreOrdersQuerySchema }) });
  router.get(`${STORE_ORDERS}/:id`, controller.getStoreOrder, { ...seller, ...describeRoute(TAG, "Get a store order", { params: StoreOrderParamsSchema }) });
  router.post(`${STORE_ORDERS}/:id/ship`, controller.ship, { ...seller, ...describeRoute(TAG, "Mark an order shipped", { params: StoreOrderParamsSchema, body: ShipOrderBodySchema }) });
  router.post(`${STORE_ORDERS}/:id/deliver`, controller.deliver, { ...seller, ...describeRoute(TAG, "Mark an order delivered", { params: StoreOrderParamsSchema }) });
  router.get("/api/v1/stores/:storeId/dashboard", controller.dashboard, { ...seller, ...describeRoute(TAG, "Seller dashboard statistics", { params: StoreParamsSchema }) });
}
