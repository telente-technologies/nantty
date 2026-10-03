import type { PaymentChannel, PaymentInitialization, PaymentProvider, PaymentVerification, SavedCardCharge } from "@/types/commerce.type";

import * as WebBrowser from "expo-web-browser";

import { shouldUseMockForPath } from "@/config/api.config";

import { api } from "./apiClient.service";

export const PAYMENT_RETURN_URL = "zudomart://payments/return";

export const paymentsService = {
  fetchPaymentChannels: () => api.get<{ channels: PaymentChannel[] }>("/api/v1/payments/channels"),
  initializeOrderPayment: (orderId: string, provider: PaymentProvider, saveCard: boolean, idempotencyKey: string) =>
    api.post<PaymentInitialization>("/api/v1/payments/initialize", { orderId, provider, saveCard }, { idempotencyKey }),
  chargeSavedCard: (orderId: string, authorizationCode: string, idempotencyKey: string) =>
    api.post<SavedCardCharge>("/api/v1/payments/charge-saved-card", { orderId, authorizationCode }, { idempotencyKey }),
  verifyOrderPayment: (orderId: string) => api.post<PaymentVerification>(`/api/v1/payments/orders/${orderId}/verify`),
  openHostedCheckoutInAppBrowser: async (authorizationUrl: string): Promise<"returned" | "dismissed"> => {
    if (shouldUseMockForPath("/api/v1/payments")) return "returned";
    const result = await WebBrowser.openAuthSessionAsync(authorizationUrl, PAYMENT_RETURN_URL);
    return result.type === "success" ? "returned" : "dismissed";
  },
};
