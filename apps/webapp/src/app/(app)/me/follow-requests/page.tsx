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
import { buildProfilePath } from "@/utils/seoPaths.util";

import styles from "../../user/[userId]/connections/page.module.css";

export default function FollowRequestsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const requests = useQuery({ queryKey: ["followRequests", "me"], queryFn: () => followsService.listMyFollowRequests(), retry: false });
  const settle = useMutation({
    mutationFn: ({ requestId, approve }: { readonly requestId: string; readonly approve: boolean }) =>
      approve ? followsService.acceptFollowRequest(requestId) : followsService.rejectFollowRequest(requestId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["followRequests"] });
      void queryClient.invalidateQueries({ queryKey: ["profile", "me"] });
    },
    onError: (error) => showToast({ text: readErrorMessageForDisplay(error), tone: "error" }),
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
                <Button size="sm" aria-label={`Approve ${request.requester.name}`} disabled={settle.isPending} onClick={() => settle.mutate({ requestId: request.id, approve: true })}>Approve</Button>
                <Button size="sm" variant="secondary" aria-label={`Decline ${request.requester.name}`} disabled={settle.isPending} onClick={() => settle.mutate({ requestId: request.id, approve: false })}>Decline</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
