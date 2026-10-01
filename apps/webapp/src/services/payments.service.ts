import type { PaymentInitialization, PaymentProvider } from "@/types/commerce.type";

import { sendRequestToWebappServer } from "./clientApi.service";

export const paymentsService = {
  initializeOrderPayment: (orderId: string, provider: PaymentProvider, idempotencyKey: string) =>
    sendRequestToWebappServer<PaymentInitialization>("/api/v1/payments/initialize", { method: "POST", body: { orderId, provider }, idempotencyKey }),
  verifyOrderPayment: (orderId: string) =>
    sendRequestToWebappServer<{ status: "pending" | "paid" | "failed" }>(`/api/v1/payments/orders/${orderId}/verify`, { method: "POST" }),
};
