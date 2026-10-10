import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { businessDocumentsService } from "@/services/moderation/businessDocuments.service";
import type { BusinessDocumentKind } from "@/types/trust.type";

export const businessDocumentsQueryKey = ["seller", "businessDocuments"] as const;

export const useBusinessDocumentsQuery = () => useQuery({ queryKey: businessDocumentsQueryKey, queryFn: businessDocumentsService.fetchMyBusinessDocuments });

export function useSubmitBusinessDocumentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ kind, localUri }: { kind: BusinessDocumentKind; localUri: string }) => businessDocumentsService.submitBusinessDocument(kind, localUri),
    onSuccess: (state) => queryClient.setQueryData(businessDocumentsQueryKey, state),
  });
}
