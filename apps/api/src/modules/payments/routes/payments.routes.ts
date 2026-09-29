import type { HttpRouter } from "@zudojs/http";

import type { WebKit } from "../../../loaders/web.loader.js";
import { createWebhookSignatureVerificationMiddleware } from "../../../middlewares/verifyWebhookSignature.middleware.js";
import { describeRoute } from "../../../utils/openapi.util.js";
import { OrderParamsSchema } from "../../orders/validators/orders.validator.js";
import type { PaymentsController } from "../controllers/payments.controller.js";
import { InitializePaymentBodySchema, PaymentParamsSchema, OrderPaymentParamsSchema, WebhookParamsSchema } from "../validators/payments.validator.js";

const TAG = "payments";

export function registerPaymentsRoutes(router: HttpRouter, controller: PaymentsController, web: WebKit): void {
  const { guard, requireIdempotencyKey } = web;
  const buyer = guard.requirePermission("orders:place");

  router.post("/api/v1/payments/initialize", controller.initialize, {
    ...guard.requirePermission("orders:place", requireIdempotencyKey),
    ...describeRoute(TAG, "Start paying for an order's checkout (Idempotency-Key required)", { body: InitializePaymentBodySchema }),
  });
  router.post("/api/v1/payments/orders/:orderId/verify", controller.verify, { ...buyer, ...describeRoute(TAG, "Check an order's payment with the provider", { params: OrderPaymentParamsSchema }) });
  router.post("/api/v1/payments/webhooks/:provider", controller.receiveWebhook, {
    ...guard.allowAnyone(createWebhookSignatureVerificationMiddleware(controller.webhookVerifiers)),
    ...describeRoute(TAG, "Payment provider webhook (signature verified)", { params: WebhookParamsSchema }),
  });
  router.get("/api/v1/payments/:id", controller.get, { ...buyer, ...describeRoute(TAG, "Get one of my payments", { params: PaymentParamsSchema }) });
  router.get("/api/v1/checkouts/:id/payments", controller.listForCheckout, { ...buyer, ...describeRoute(TAG, "List payments for my checkout", { params: PaymentParamsSchema }) });
  router.post("/api/v1/admin/orders/:id/refund", controller.refundOrder, {
    ...guard.requirePermission("disputes:resolve", requireIdempotencyKey),
    ...describeRoute(TAG, "Refund an order's escrowed payment (Idempotency-Key required)", { params: OrderParamsSchema }),
  });
}
