import type { EscrowDetail } from "@/types/commerce.type";
import type { Order } from "@/types";

import { api } from "../core/apiClient.service";

export const escrowsService = {
  fetchEscrowForOrder: (orderId: string) => api.get<EscrowDetail>(`/api/v1/orders/${encodeURIComponent(orderId)}/escrow`),
  confirmOrderReceiptAndReleaseEscrow: (orderId: string, idempotencyKey: string) =>
    api.post<Order>(`/api/v1/orders/${encodeURIComponent(orderId)}/confirm-receipt`, undefined, { idempotencyKey }),
};
