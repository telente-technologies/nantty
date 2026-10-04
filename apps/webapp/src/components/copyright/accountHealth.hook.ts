"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useSession } from "@/components/providers/sessionProvider";
import { ACCOUNT_HEALTH_QUERY_KEY, copyrightAccountService } from "@/services/copyrightAccount.service";
import type { CounterNoticeInput, ID } from "@/types";

export function useMyAccountHealth() {
  const { viewer } = useSession();
  return useQuery({ queryKey: ACCOUNT_HEALTH_QUERY_KEY, queryFn: copyrightAccountService.fetchMyAccountHealth, enabled: !!viewer, staleTime: 60_000 });
}

export function useAccountHealthActions() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ACCOUNT_HEALTH_QUERY_KEY });
  const appeal = useMutation({ mutationFn: ({ strikeId, message }: { strikeId: ID; message: string }) => copyrightAccountService.appealStrike(strikeId, message), onSuccess: refresh });
  const counterNotice = useMutation({ mutationFn: ({ claimId, input }: { claimId: ID; input: CounterNoticeInput }) => copyrightAccountService.submitCounterNotice(claimId, input), onSuccess: refresh });
  return { appeal, counterNotice };
}
