import type { PaymentInitialization, PaymentProvider } from "@/types/commerce.type";

import * as WebBrowser from "expo-web-browser";

import { apiConfig } from "@/config/api.config";

import { api } from "./apiClient.service";

export const PAYMENT_RETURN_URL = "zudomart://payments/return";

export const paymentsService = {
  initializeOrderPayment: (orderId: string, provider: PaymentProvider, idempotencyKey: string) =>
    api.post<PaymentInitialization>("/api/v1/payments/initialize", { orderId, provider }, { idempotencyKey }),
  verifyOrderPayment: (orderId: string) => api.post<{ status: "pending" | "paid" | "failed" }>(`/api/v1/payments/orders/${orderId}/verify`),
  openHostedCheckoutInAppBrowser: async (checkoutUrl: string): Promise<"returned" | "dismissed"> => {
    if (apiConfig.useMocks) return "returned";
    const result = await WebBrowser.openAuthSessionAsync(checkoutUrl, PAYMENT_RETURN_URL);
    return result.type === "success" ? "returned" : "dismissed";
  },
};
