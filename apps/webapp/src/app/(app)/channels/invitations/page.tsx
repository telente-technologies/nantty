"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { SignInRequiredState } from "@/components/auth/signInRequiredState";
import { useSession } from "@/components/providers/sessionProvider";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, InlineSpinner } from "@/components/ui/feedback";
import { channelsService, type ChannelInvitation } from "@/services/channels.service";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";

import styles from "./page.module.css";

const inboxKey = ["channel-invitations", "received"] as const;

export default function ChannelInvitationsInboxPage() {
  const { viewer } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const inbox = useQuery({ queryKey: inboxKey, queryFn: () => channelsService.listInvitations(), enabled: Boolean(viewer), retry: false });
  const respond = useMutation({
    mutationFn: ({ invitationId, accept }: { readonly invitationId: string; readonly accept: boolean }) => accept ? channelsService.acceptInvitation(invitationId) : channelsService.declineInvitation(invitationId),
    onSuccess: async (invitation, variables) => {
      await queryClient.invalidateQueries({ queryKey: inboxKey });
      if (variables.accept) {
        await queryClient.invalidateQueries({ queryKey: ["conversations"] });
        router.push(`/chats/${encodeURIComponent(invitation.channelId)}`);
      }
    },
  });

  if (!viewer) return <main className={styles.page}><SignInRequiredState title="Sign in to view channel invitations" /></main>;
  if (inbox.isPending) return <main className={styles.page}><InlineSpinner label="Loading channel invitations" /></main>;
  if (inbox.isError) return <main className={styles.page}><ErrorState error={inbox.error} description="We couldn't load your channel invitations." onRetry={() => void inbox.refetch()} /></main>;

  const invitations = inbox.data.data.filter((invitation) => invitation.status === "pending");
  return <main className={styles.page}>
    <header className={styles.header}><div><h1 className={styles.title}>Channel invitations</h1><p className={styles.subtitle}>Review each invitation. Accepting subscribes you to the channel; declining does not.</p></div><Link href="/chats" className={styles.backLink}>Back to messages</Link></header>
    {invitations.length === 0 ? <EmptyState title="No pending channel invitations" description="Channel invitations you request from a link will appear here." /> : <ul className={styles.list}>
      {invitations.map((invitation) => <InvitationRow key={invitation.id} invitation={invitation} busy={respond.isPending && respond.variables?.invitationId === invitation.id} onRespond={(accept) => respond.mutate({ invitationId: invitation.id, accept })} />)}
    </ul>}
    {respond.isError ? <p className={styles.error} role="alert">{readErrorMessageForDisplay(respond.error)}</p> : null}
  </main>;
}

function InvitationRow({ invitation, busy, onRespond }: { readonly invitation: ChannelInvitation; readonly busy: boolean; readonly onRespond: (accept: boolean) => void }) {
  return <li className={styles.invitation}>
    <div><h2 className={styles.invitationTitle}>{invitation.channelTitle?.trim() || "Nantty channel"}</h2><p className={styles.subtitle}>You were invited to subscribe. Accept to join this channel, or decline to dismiss the invitation.</p></div>
    <div className={styles.actions}><Button variant="secondary" disabled={busy} onClick={() => onRespond(false)}>Decline</Button><Button busy={busy} onClick={() => onRespond(true)}>Accept invitation</Button></div>
  </li>;
}
