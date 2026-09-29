import type { HttpRouter } from "@zudojs/http";

import type { WebKit } from "../../../loaders/web.loader.js";
import { describeRoute } from "../../../utils/openapi.util.js";
import { OrderParamsSchema } from "../../orders/validators/orders.validator.js";
import type { EscrowsController } from "../controllers/escrows.controller.js";
import { DisputeParamsSchema, ListDisputesQuerySchema, OpenDisputeBodySchema, ResolveDisputeBodySchema } from "../validators/escrows.validator.js";

const TAG = "escrows";

export function registerEscrowsRoutes(router: HttpRouter, controller: EscrowsController, web: WebKit): void {
  const { guard, requireIdempotencyKey } = web;
  router.get("/api/v1/orders/:id/escrow", controller.getForOrder, { ...guard.requirePermission("orders:read-own"), ...describeRoute(TAG, "Get the escrow holding an order's payment", { params: OrderParamsSchema }) });
  router.post("/api/v1/orders/:id/disputes", controller.openDispute, {
    ...guard.requirePermission("disputes:open"),
    ...describeRoute(TAG, "Open a dispute and freeze the escrow", { params: OrderParamsSchema, body: OpenDisputeBodySchema }),
  });
  router.get("/api/v1/admin/disputes", controller.listDisputes, { ...guard.requirePermission("disputes:resolve"), ...describeRoute(TAG, "List disputes", { query: ListDisputesQuerySchema }) });
  router.post("/api/v1/admin/disputes/:id/resolve", controller.resolveDispute, {
    ...guard.requirePermission("disputes:resolve", requireIdempotencyKey),
    ...describeRoute(TAG, "Resolve a dispute by releasing or refunding (Idempotency-Key required)", { params: DisputeParamsSchema, body: ResolveDisputeBodySchema }),
  });
}
