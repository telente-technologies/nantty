"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { ArrowLeftIcon } from "@/components/ui/icons";
import { Avatar } from "@/components/ui/media";
import { showToast } from "@/components/ui/toast";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { followsService } from "@/services/posts.service";
import type { FollowRequest, Page } from "@/types";
import { removeFollowRequestFromPage } from "@/utils/followRequests.util";
import { buildProfilePath } from "@/utils/seoPaths.util";

import styles from "../../user/[userId]/connections/page.module.css";

const followRequestsKey = ["followRequests", "me"] as const;

export default function FollowRequestsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const requests = useQuery({ queryKey: followRequestsKey, queryFn: () => followsService.listMyFollowRequests(), retry: false });
  const settle = useMutation({
    mutationFn: ({ requestId, approve }: { readonly requestId: string; readonly approve: boolean; readonly requesterName: string }) =>
      approve ? followsService.acceptFollowRequest(requestId) : followsService.rejectFollowRequest(requestId),
    onMutate: async ({ requestId }) => {
      await queryClient.cancelQueries({ queryKey: followRequestsKey });
      const previous = queryClient.getQueryData<Page<FollowRequest>>(followRequestsKey);
      queryClient.setQueryData<Page<FollowRequest>>(followRequestsKey, (page) => removeFollowRequestFromPage(page, requestId));
      return { previous };
    },
    onError: (error, { approve, requesterName }, snapshot) => {
      if (snapshot?.previous) queryClient.setQueryData(followRequestsKey, snapshot.previous);
      showToast({ text: `Couldn't ${approve ? "confirm" : "delete"} ${requesterName}'s request. ${readErrorMessageForDisplay(error)}`, tone: "error" });
    },
    onSettled: (_result, _error, { approve }) => {
      void queryClient.invalidateQueries({ queryKey: ["followRequests"] });
      if (approve) void queryClient.invalidateQueries({ queryKey: ["profile", "me"] });
    },
  });

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button type="button" className={styles.back} aria-label="Back" onClick={() => router.back()}><ArrowLeftIcon size={18} /></button>
        <h1 className={styles.title}>Follow requests</h1>
      </header>
      {requests.isPending ? (
        <div className={styles.list} aria-hidden="true">{[0, 1, 2].map((index) => <Skeleton key={index} height={56} />)}</div>
      ) : requests.isError ? (
        <ErrorState description="Couldn't load follow requests." error={requests.error} onRetry={() => void requests.refetch()} />
      ) : requests.data.data.length === 0 ? (
        <EmptyState title="No pending requests" />
      ) : (
        <ul className={styles.list}>
          {requests.data.data.map((request) => (
            <li key={request.id} className={styles.row}>
              <Link href={buildProfilePath(request.requester.username)} className={styles.person}>
                <Avatar name={request.requester.name} src={request.requester.avatarUrl} size="md" />
                <span className={styles.personText}>
                  <strong>{request.requester.name}</strong>
                  <span>@{request.requester.username}</span>
                </span>
              </Link>
              <div className={styles.rowActions}>
                <Button size="sm" aria-label={`Confirm ${request.requester.name}'s follow request`} onClick={() => settle.mutate({ requestId: request.id, approve: true, requesterName: request.requester.name })}>Confirm</Button>
                <Button size="sm" variant="secondary" aria-label={`Delete ${request.requester.name}'s follow request`} onClick={() => settle.mutate({ requestId: request.id, approve: false, requesterName: request.requester.name })}>Delete</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
