"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { linkedProfilesService } from "@/services/linkedProfiles.service";
import type { StoreTeamRequest } from "@/types/brand.type";

import styles from "./settings.module.css";

const teamRequestsQueryKey = ["stores", "team-requests"] as const;

export function StoreTeamRequestsSection() {
  const queryClient = useQueryClient();
  const requests = useQuery({
    queryKey: teamRequestsQueryKey,
    queryFn: linkedProfilesService.fetchStoreTeamRequests,
    retry: false,
  });
  const respond = useMutation({
    mutationFn: ({ requestId, decision }: { readonly requestId: string; readonly decision: "accept" | "decline" }) =>
      decision === "accept"
        ? linkedProfilesService.acceptStoreTeamRequest(requestId)
        : linkedProfilesService.declineStoreTeamRequest(requestId),
    onSuccess: (_result, { requestId }) => {
      queryClient.setQueryData<readonly StoreTeamRequest[]>(teamRequestsQueryKey, (current = []) =>
        current.filter((item) => item.id !== requestId),
      );
      void queryClient.invalidateQueries({ queryKey: ["users", "me", "linked-profiles"] });
    },
  });

  const items = requests.data ?? [];
  if (requests.isPending || requests.isError || items.length === 0) return null;

  return (
    <section className={styles.block} aria-labelledby="store-team-requests-heading">
      <h2 id="store-team-requests-heading" className={styles.blockHeading}>Store team invitations</h2>
      <p className={styles.muted}>Stores that invited you to help manage orders, catalog or accounting.</p>
      {respond.isError ? <p className={styles.errorText} role="alert">{readErrorMessageForDisplay(respond.error)}</p> : null}
      {items.map((invite) => (
        <div key={invite.id} className={styles.row}>
          <div>
            <strong>{invite.storeName}</strong>
            <p className={styles.muted}>Role: {invite.role}</p>
          </div>
          <div className={styles.buttonRow}>
            <Button size="sm" busy={respond.isPending} onClick={() => respond.mutate({ requestId: invite.id, decision: "accept" })}>
              Accept
            </Button>
            <Button size="sm" variant="secondary" disabled={respond.isPending} onClick={() => respond.mutate({ requestId: invite.id, decision: "decline" })}>
              Decline
            </Button>
          </div>
        </div>
      ))}
    </section>
  );
}
