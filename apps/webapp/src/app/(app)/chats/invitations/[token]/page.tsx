"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";

import { SignInRequiredState } from "@/components/auth/signInRequiredState";
import { useSession } from "@/components/providers/sessionProvider";
import { Button } from "@/components/ui/button";
import { ErrorState, InlineSpinner } from "@/components/ui/feedback";
import { groupInvitationsService } from "@/services/chatGroups.service";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";

import styles from "./page.module.css";

function expiryLabel(expiresAt: string): string {
  const expiry = new Date(expiresAt);
  return Number.isNaN(expiry.valueOf()) ? "Expiry unavailable" : `Link expires ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(expiry)}`;
}

export default function GroupInvitationLinkPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const { viewer } = useSession();
  const queryClient = useQueryClient();
  const preview = useQuery({
    queryKey: ["group-invitation-link", "preview", token],
    queryFn: () => groupInvitationsService.previewLink(token),
    enabled: Boolean(viewer && token),
    retry: false,
  });
  const claim = useMutation({
    mutationFn: () => groupInvitationsService.claimLink(token),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["group-invitations", "received"] });
    },
  });

  if (!viewer) {
    return <div className={styles.page}><SignInRequiredState title="Sign in to view this group invitation" description="Group invitation links are private. Sign in to preview the group and request an invitation." /></div>;
  }

  if (claim.isSuccess) {
    return (
      <main className={styles.page}>
        <section className={styles.card} aria-labelledby="claim-complete-title">
          <span className={styles.eyebrow}>Invitation request sent</span>
          <h1 id="claim-complete-title" className={styles.title}>You’re not in the group yet</h1>
          <p className={styles.description}>Your request is now in your group invitations inbox. Accept it there to continue; the group will remain unavailable until secure encryption keys are handed off.</p>
          <Link className={styles.inboxLink} href="/chats/invitations">Open group invitations</Link>
          <p className={styles.note}>Accepting an invitation does not add you to the conversation or reveal its messages. Secure key setup is still required.</p>
        </section>
      </main>
    );
  }

  if (preview.isPending) {
    return <main className={styles.page}><section className={styles.card}><InlineSpinner label="Checking this invitation" /></section></main>;
  }

  if (preview.isError) {
    return <main className={styles.page}><section className={styles.card}>
      <ErrorState error={preview.error} title="This invitation is unavailable" description="It may have expired or been revoked. Ask a group member for a new link." onRetry={() => void preview.refetch()} />
    </section></main>;
  }

  const { group } = preview.data;
  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="group-invitation-title">
        <span className={styles.eyebrow}>Nantty group invitation</span>
        <h1 id="group-invitation-title" className={styles.title}>You’re invited to {group.title?.trim() || "a private group"}</h1>
        <p className={styles.memberCount}>{group.memberCount} {group.memberCount === 1 ? "member" : "members"}</p>
        <p className={styles.description}>Request an invitation to continue. You’ll need to explicitly accept it from your invitations inbox. Secure group access is only available after encryption key handoff.</p>
        <p className={styles.expiry}>{expiryLabel(preview.data.expiresAt)}</p>
        <Button fullWidth busy={claim.isPending} onClick={() => claim.mutate()}>Request invitation</Button>
        {claim.isError ? <p className={styles.error} role="alert">{readErrorMessageForDisplay(claim.error)}</p> : null}
        <p className={styles.note}>This preview does not expose group messages, member identities, or encryption data.</p>
      </section>
    </main>
  );
}
