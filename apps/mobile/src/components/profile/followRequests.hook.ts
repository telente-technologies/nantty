import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { followsService } from "@/services/social/follows.service";

export const followRequestsQueryKey = ["users", "me", "follow-requests"] as const;

export function useFollowRequestsQuery() {
  return useQuery({ queryKey: followRequestsQueryKey, queryFn: () => followsService.listMyFollowRequests() });
}

export function useSettleFollowRequestMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, approve }: { requestId: string; approve: boolean }) =>
      approve ? followsService.acceptFollowRequest(requestId) : followsService.rejectFollowRequest(requestId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });
}
