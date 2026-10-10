import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ACCOUNT_HEALTH_QUERY_KEY, accountHealthService } from "@/services/account/accountHealth.service";
import { useAuthStore } from "@/store/auth.store";
import type { CounterNoticeInput, ID } from "@/types";

export function useMyAccountHealth() {
  const isSignedIn = useAuthStore((state) => !!state.user);
  return useQuery({ queryKey: ACCOUNT_HEALTH_QUERY_KEY, queryFn: accountHealthService.fetchMyAccountHealth, enabled: isSignedIn, staleTime: 60_000 });
}

export function useAppealStrike() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ strikeId, message }: { strikeId: ID; message: string }) => accountHealthService.appealStrike(strikeId, message),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ACCOUNT_HEALTH_QUERY_KEY }),
  });
}

export function useSubmitCounterNotice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ claimId, input }: { claimId: ID; input: CounterNoticeInput }) => accountHealthService.submitCounterNotice(claimId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ACCOUNT_HEALTH_QUERY_KEY }),
  });
}

export function usePendingCopyrightNoticeFor(contentId: ID | undefined) {
  const { data } = useMyAccountHealth();
  return contentId ? data?.notices.find((notice) => notice.content.id === contentId && notice.state === "AWAITING_REMOVAL" && notice.deadlineAt) ?? null : null;
}
