import type { PaymentInitialization, PaymentProvider } from "@/types/commerce.type";

import { api } from "./apiClient.service";

export const paymentsService = {
  initializeOrderPayment: (orderId: string, provider: PaymentProvider, idempotencyKey: string) =>
    api.post<PaymentInitialization>("/api/v1/payments/initialize", { orderId, provider }, { idempotencyKey }),
  verifyOrderPayment: (orderId: string) => api.post<{ status: "pending" | "paid" | "failed" }>(`/api/v1/payments/orders/${orderId}/verify`),
};
