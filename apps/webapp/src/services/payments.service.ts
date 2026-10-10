import { paymentReturnUrl } from "@/utils/paymentReturn.util";
import type { PaymentChannel, PaymentInitialization, PaymentProvider } from "@/types/commerce.type";

import { sendRequestToWebappServer } from "./clientApi.service";

export const paymentsService = {
  fetchPaymentChannels: () => sendRequestToWebappServer<{ readonly channels: readonly PaymentChannel[] }>("/api/v1/payments/channels"),
  initializeOrderPayment: (orderId: string, provider: PaymentProvider, idempotencyKey: string) =>
    sendRequestToWebappServer<PaymentInitialization>("/api/v1/payments/initialize", { method: "POST", body: { orderId, provider, returnTo: paymentReturnUrl() }, idempotencyKey }),
  verifyOrderPayment: (orderId: string) =>
    sendRequestToWebappServer<{ status: "pending" | "paid" | "failed" }>(`/api/v1/payments/orders/${orderId}/verify`, { method: "POST" }),
};
