import { paymentReturnUrl } from "@/utils/paymentReturn.util";
import type { PaymentChannel, PaymentInitialization } from "@/types/commerce.type";

import { sendRequestToWebappServer } from "./clientApi.service";

export const paymentsService = {
  fetchPaymentChannels: () => sendRequestToWebappServer<{ readonly channels: readonly PaymentChannel[] }>("/api/v1/payments/channels"),
  initializeOrderPayment: (orderId: string, idempotencyKey: string) =>
    sendRequestToWebappServer<PaymentInitialization>("/api/v1/payments/initialize", { method: "POST", body: { orderId, returnTo: paymentReturnUrl() }, idempotencyKey }),
  fetchPaymentStatus: (reference: string) =>
    sendRequestToWebappServer<{ reference: string; purpose: string; status: "pending" | "succeeded" | "failed" | "cancelled" }>(`/api/v1/payments/${encodeURIComponent(reference)}`),
  verifyOrderPayment: (orderId: string) =>
    sendRequestToWebappServer<{ status: "pending" | "paid" | "failed" }>(`/api/v1/payments/orders/${orderId}/verify`, { method: "POST" }),
};
