import type { Dispute, DisputeMessage, OpenDisputeInput } from "@/types/commerce.type";

import { api } from "../core/apiClient.service";

export const disputesService = {
  openDisputeForOrder: (orderId: string, input: OpenDisputeInput, idempotencyKey: string) =>
    api.post<Dispute>(`/api/v1/orders/${encodeURIComponent(orderId)}/disputes`, input, { idempotencyKey }),
  listMyDisputes: () => api.getList<Dispute>("/api/v1/disputes"),
  fetchDisputeById: (disputeId: string) => api.get<Dispute>(`/api/v1/disputes/${encodeURIComponent(disputeId)}`),
  sendDisputeMessage: (disputeId: string, text: string, attachmentUrls: readonly string[], idempotencyKey: string) =>
    api.post<DisputeMessage>(`/api/v1/disputes/${encodeURIComponent(disputeId)}/messages`, { text, attachmentUrls }, { idempotencyKey }),
};
