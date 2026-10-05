import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { consentsService } from "@/services/consents.service";
import { refreshTrackingConsents } from "@/services/productInteractions.service";
import type { ConsentChoices, ConsentKey, ConsentRecord } from "@/types";

export const privacyQueryKeys = {
  consents: ["privacy", "consents"] as const,
  dataExport: ["privacy", "dataExport"] as const,
};

export const useConsentsQuery = () => useQuery({ queryKey: privacyQueryKeys.consents, queryFn: consentsService.fetchMyConsents });

export function useUpdateConsentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, enabled }: { key: ConsentKey; enabled: boolean }) =>
      consentsService.updateMyConsents({ consents: { [key]: enabled } as Partial<ConsentChoices> }),
    onMutate: async ({ key, enabled }) => {
      await queryClient.cancelQueries({ queryKey: privacyQueryKeys.consents });
      const previous = queryClient.getQueryData<ConsentRecord>(privacyQueryKeys.consents);
      if (previous) queryClient.setQueryData(privacyQueryKeys.consents, { ...previous, consents: { ...previous.consents, [key]: enabled } });
      return { previous };
    },
    onError: (_error, _input, context) => context?.previous && queryClient.setQueryData(privacyQueryKeys.consents, context.previous),
    onSuccess: (record) => {
      queryClient.setQueryData(privacyQueryKeys.consents, record);
      refreshTrackingConsents();
    },
  });
}

export const useDataExportQuery = () =>
  useQuery({
    queryKey: privacyQueryKeys.dataExport,
    queryFn: consentsService.fetchMyDataExport,
    refetchInterval: (query) => (query.state.data?.status === "requested" || query.state.data?.status === "processing" ? 2000 : false),
  });

export function useRequestDataExportMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: consentsService.requestMyDataExport,
    onSuccess: (request) => queryClient.setQueryData(privacyQueryKeys.dataExport, request),
  });
}
