"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";

import { SignInRequiredState } from "@/components/auth/signInRequiredState";
import { useSession } from "@/components/providers/sessionProvider";
import { Button } from "@/components/ui/button";
import { ErrorState, InlineSpinner } from "@/components/ui/feedback";
import { channelsService } from "@/services/channels.service";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";

import styles from "./page.module.css";

export default function ChannelInvitationLinkPage() {
  const { token } = useParams<{ token: string }>();
  const { viewer } = useSession();
  const queryClient = useQueryClient();
  const preview = useQuery({
    queryKey: ["channel-invitation-link", "preview", token],
    queryFn: () => channelsService.previewInvitationLink(token),
    enabled: Boolean(viewer && token),
    retry: false,
  });
  const claim = useMutation({
    mutationFn: () => channelsService.claimInvitationLink(token),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["channel-invitations", "received"] }),
  });

  if (!viewer) return <main className={styles.page}><SignInRequiredState title="Sign in to view this channel invitation" description="Sign in to preview the channel and request an invitation." /></main>;
  if (claim.isSuccess) return <main className={styles.page}><section className={styles.card}>
    <span className={styles.eyebrow}>Invitation request sent</span>
    <h1 className={styles.title}>You’re not subscribed yet</h1>
    <p className={styles.description}>Your request is pending. Open your channel invitations and explicitly accept it to subscribe.</p>
    <Link className={styles.link} href="/channels/invitations">Review channel invitations</Link>
  </section></main>;
  if (preview.isPending) return <main className={styles.page}><section className={styles.card}><InlineSpinner label="Checking this invitation" /></section></main>;
  if (preview.isError) return <main className={styles.page}><section className={styles.card}><ErrorState error={preview.error} title="This invitation is unavailable" description="It may have expired or been revoked. Ask the channel owner for a new link." onRetry={() => void preview.refetch()} /></section></main>;

  const { channel, expiresAt } = preview.data;
  const expiry = new Date(expiresAt);
  return <main className={styles.page}><section className={styles.card} aria-labelledby="channel-invitation-title">
    <span className={styles.eyebrow}>Nantty channel invitation</span>
    <h1 id="channel-invitation-title" className={styles.title}>You’re invited to {channel.title?.trim() || "a channel"}</h1>
    <p className={styles.description}>{channel.subscriberCount} {channel.subscriberCount === 1 ? "subscriber" : "subscribers"}. Requesting creates a pending invitation only; you must explicitly accept before subscribing.</p>
    <p className={styles.expiry}>{Number.isNaN(expiry.valueOf()) ? "Expiry unavailable" : `Link expires ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(expiry)}`}</p>
    <Button fullWidth busy={claim.isPending} onClick={() => claim.mutate()}>Request invitation</Button>
    {claim.isError ? <p className={styles.error} role="alert">{readErrorMessageForDisplay(claim.error)}</p> : null}
  </section></main>;
}
