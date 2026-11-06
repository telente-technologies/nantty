"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";

import { SignInRequiredState } from "@/components/auth/signInRequiredState";
import { useSession } from "@/components/providers/sessionProvider";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, InlineSpinner } from "@/components/ui/feedback";
import { groupInvitationsService, type GroupInvitation } from "@/services/chatGroups.service";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";

import styles from "./page.module.css";

const inboxKey = ["group-invitations", "received"] as const;

export default function GroupInvitationsInboxPage() {
  const { viewer } = useSession();
  const queryClient = useQueryClient();
  const inbox = useQuery({ queryKey: inboxKey, queryFn: () => groupInvitationsService.listReceived(), enabled: Boolean(viewer), retry: false });
  const respond = useMutation({
    mutationFn: ({ invitationId, accept }: { readonly invitationId: string; readonly accept: boolean }) => accept ? groupInvitationsService.accept(invitationId) : groupInvitationsService.decline(invitationId),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: inboxKey }),
  });

  if (!viewer) return <main className={styles.page}><SignInRequiredState title="Sign in to view group invitations" /></main>;
  if (inbox.isPending) return <main className={styles.page}><InlineSpinner label="Loading group invitations" /></main>;
  if (inbox.isError) return <main className={styles.page}><ErrorState error={inbox.error} description="We couldn't load your group invitations." onRetry={() => void inbox.refetch()} /></main>;

  const visibleInvitations = inbox.data.data.filter((invitation) => invitation.status === "pending" || (invitation.status === "accepted" && invitation.membershipStatus === "awaiting_secure_key_handoff"));
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div><h1 className={styles.title}>Group invitations</h1><p className={styles.subtitle}>Review each request before continuing to secure setup.</p></div>
        <Link href="/chats" className={styles.backLink}>Back to messages</Link>
      </header>
      {visibleInvitations.length === 0 ? <EmptyState title="No pending group invitations" description="When someone invites you to a group, you can review it here." /> : (
        <ul className={styles.list}>
          {visibleInvitations.map((invitation) => <InvitationRow key={invitation.id} invitation={invitation} busy={respond.isPending} onRespond={(accept) => respond.mutate({ invitationId: invitation.id, accept })} />)}
        </ul>
      )}
      {respond.isError ? <p className={styles.error} role="alert">{readErrorMessageForDisplay(respond.error)}</p> : null}
    </main>
  );
}

function InvitationRow({ invitation, busy, onRespond }: { readonly invitation: GroupInvitation; readonly busy: boolean; readonly onRespond: (accept: boolean) => void }) {
  const inviter = invitation.counterpart?.name || "A Nantty member";
  const alreadyAccepted = invitation.status === "accepted";
  return (
    <li className={styles.invitation}>
      <div className={styles.invitationCopy}>
        <h2 className={styles.invitationTitle}>{alreadyAccepted ? "Invitation accepted" : `${inviter} invited you to a group`}</h2>
        <p className={styles.subtitle}>{alreadyAccepted ? "Your consent is recorded. Group access remains unavailable until secure key handoff is complete." : "Accepting records your consent only. You will not join or see group history until secure key handoff is complete."}</p>
      </div>
      {!alreadyAccepted ? <div className={styles.actions}>
        <Button variant="secondary" disabled={busy} onClick={() => onRespond(false)}>Decline</Button>
        <Button busy={busy} onClick={() => onRespond(true)}>Accept invitation</Button>
      </div> : null}
      {alreadyAccepted || invitation.membershipStatus === "awaiting_secure_key_handoff" ? <p className={styles.note} role="status">Waiting for secure encryption key handoff. Group membership and history are not available yet.</p> : null}
    </li>
  );
}
