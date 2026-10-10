import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";

import { generateIdempotencyKey } from "@/services/core/apiClient.service";
import { disputesService } from "@/services/moderation/disputes.service";
import { escrowsService } from "@/services/commerce/escrows.service";

export const escrowQueryKeys = {
  forOrder: (orderId: string) => ["escrow", orderId] as const,
  dispute: (disputeId: string) => ["disputes", disputeId] as const,
  disputes: ["disputes"] as const,
};

export const useEscrowForOrderQuery = (orderId: string) =>
  useQuery({ queryKey: escrowQueryKeys.forOrder(orderId), queryFn: () => escrowsService.fetchEscrowForOrder(orderId) });

export const useDisputeQuery = (disputeId: string) =>
  useQuery({ queryKey: escrowQueryKeys.dispute(disputeId), queryFn: () => disputesService.fetchDisputeById(disputeId) });

export function useConfirmReceiptMutation(orderId: string) {
  const queryClient = useQueryClient();
  const idempotencyKeyForThisConfirmation = useRef(generateIdempotencyKey());
  return useMutation({
    mutationFn: () => escrowsService.confirmOrderReceiptAndReleaseEscrow(orderId, idempotencyKeyForThisConfirmation.current),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: escrowQueryKeys.forOrder(orderId) });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}
