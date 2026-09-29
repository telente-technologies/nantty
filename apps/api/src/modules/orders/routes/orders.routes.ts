import type { HttpMiddleware, HttpRouter } from "@zudojs/http";

import type { WebKit } from "../../../loaders/web.loader.js";
import { describeRoute } from "../../../utils/openapi.util.js";
import type { OrdersController } from "../controllers/orders.controller.js";
import type { SellerOrdersController } from "../controllers/sellerOrders.controller.js";
import {
  CheckoutBodySchema,
  ListBuyerOrdersQuerySchema,
  ListSellerOrdersQuerySchema,
  OrderParamsSchema,
  SellerDashboardQuerySchema,
  ShipOrderBodySchema,
} from "../validators/orders.validator.js";

const TAG = "orders";

export function registerOrdersRoutes(router: HttpRouter, controller: OrdersController, sellerController: SellerOrdersController, web: WebKit, requireSellerTools: HttpMiddleware): void {
  const { guard, requireIdempotencyKey } = web;
  const buyer = guard.requirePermission("orders:read-own");
  const seller = guard.requirePermission("orders:fulfil");

  router.post("/api/v1/orders/checkout", controller.checkout, {
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
  router.get("/api/v1/seller/orders", sellerController.list, { ...seller, ...describeRoute(TAG, "List my store's orders", { query: ListSellerOrdersQuerySchema }) });
  router.get("/api/v1/seller/orders/:id", sellerController.get, { ...seller, ...describeRoute(TAG, "Get one of my store's orders", { params: OrderParamsSchema }) });
  router.post("/api/v1/seller/orders/:id/ship", sellerController.ship, { ...seller, ...describeRoute(TAG, "Mark an order shipped with courier and tracking number", { params: OrderParamsSchema, body: ShipOrderBodySchema }) });
  router.post("/api/v1/seller/orders/:id/deliver", sellerController.deliver, { ...seller, ...describeRoute(TAG, "Mark an order delivered", { params: OrderParamsSchema }) });
  router.get("/api/v1/seller/dashboard", sellerController.dashboard, { ...guard.requirePermission("orders:fulfil", requireSellerTools), ...describeRoute(TAG, "Seller dashboard for a period (Gold verified store with an active Gold plan)", { query: SellerDashboardQuerySchema }) });
}
