import type { Dispute, DisputeMessage, EscrowDetail, OpenDisputeInput } from "@/types/commerce.type";
import type { Order } from "@/types";

import { sendListRequestToWebappServer, sendRequestToWebappServer } from "./clientApi.service";

export const disputesService = {
  openDisputeForOrder: (orderId: string, input: OpenDisputeInput, idempotencyKey: string) =>
    sendRequestToWebappServer<Dispute>(`/api/v1/orders/${encodeURIComponent(orderId)}/disputes`, { method: "POST", body: input, idempotencyKey }),
  listMyDisputes: () => sendListRequestToWebappServer<Dispute>("/api/v1/disputes"),
  fetchDisputeById: (disputeId: string) => sendRequestToWebappServer<Dispute>(`/api/v1/disputes/${encodeURIComponent(disputeId)}`),
  sendDisputeMessage: (disputeId: string, text: string, attachmentUrls: readonly string[], idempotencyKey: string) =>
    sendRequestToWebappServer<DisputeMessage>(`/api/v1/disputes/${encodeURIComponent(disputeId)}/messages`, { method: "POST", body: { text, attachmentUrls }, idempotencyKey }),
};

export const escrowsService = {
  fetchEscrowForOrder: (orderId: string) => sendRequestToWebappServer<EscrowDetail>(`/api/v1/orders/${encodeURIComponent(orderId)}/escrow`),
  confirmOrderReceiptAndReleaseEscrow: (orderId: string, idempotencyKey: string) =>
    sendRequestToWebappServer<Order>(`/api/v1/orders/${encodeURIComponent(orderId)}/confirm-receipt`, { method: "POST", idempotencyKey }),
};

export const escrowQueryKeys = {
  forOrder: (orderId: string) => ["escrow", orderId] as const,
  dispute: (disputeId: string) => ["disputes", disputeId] as const,
};
