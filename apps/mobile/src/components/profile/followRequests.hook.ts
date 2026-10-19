import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { followsService } from "@/services/social/follows.service";
import { showToast } from "@/store/toast.store";
import type { Page } from "@/types";
import type { FollowRequest } from "@/types/socialGraph.type";

export const followRequestsQueryKey = ["users", "me", "follow-requests"] as const;

export function useFollowRequestsQuery() {
  return useQuery({ queryKey: followRequestsQueryKey, queryFn: () => followsService.listMyFollowRequests() });
}

export interface SettleFollowRequestInput {
  readonly requestId: string;
  readonly approve: boolean;
  readonly requesterName?: string;
}

export const removeFollowRequestFromPage = (page: Page<FollowRequest> | undefined, requestId: string): Page<FollowRequest> | undefined =>
  page ? { ...page, data: page.data.filter((request) => request.id !== requestId) } : page;

export function useSettleFollowRequestMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, approve }: SettleFollowRequestInput) =>
      approve ? followsService.acceptFollowRequest(requestId) : followsService.rejectFollowRequest(requestId),
    onMutate: async ({ requestId }) => {
      await queryClient.cancelQueries({ queryKey: followRequestsQueryKey });
      const previous = queryClient.getQueryData<Page<FollowRequest>>(followRequestsQueryKey);
      queryClient.setQueryData<Page<FollowRequest>>(followRequestsQueryKey, (page) => removeFollowRequestFromPage(page, requestId));
      return { previous };
    },
    onError: (_error, { approve, requesterName }, snapshot) => {
      if (snapshot?.previous) queryClient.setQueryData(followRequestsQueryKey, snapshot.previous);
      showToast(`Couldn't ${approve ? "confirm" : "delete"} ${requesterName ? `${requesterName}'s` : "this"} request. Try again.`, { tone: "error" });
    },
    onSettled: (_result, _error, { approve }) => {
      void queryClient.invalidateQueries({ queryKey: followRequestsQueryKey });
      if (approve) void queryClient.invalidateQueries({ queryKey: ["users", "me"], exact: true });
    },
  });
}
