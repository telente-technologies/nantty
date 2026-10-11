"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";

import styles from "@/components/escrow/escrow.module.css";
import { Button } from "@/components/ui/button";
import { requestConfirmation } from "@/components/ui/confirmDialog";
import { Badge, EmptyState, ErrorState } from "@/components/ui/feedback";
import { Avatar } from "@/components/ui/media";
import { ListRowsSkeleton } from "@/components/ui/pageSkeletons";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { usersService } from "@/services/users.service";
import { creatorSubscriptionsService } from "@/services/webActions.service";
import type { CreatorSubscriptionState } from "@/types/creator.type";
import { canCancelCreatorSubscription, canResumeCreatorSubscription, CREATOR_SUBSCRIPTION_STATUS_PRESENTATION, formatSubscriptionDay, STORE_SUBSCRIPTION_SETTINGS_URLS } from "@/utils/creatorSubscriptions.util";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

const mySubscriptionsQueryKey = ["creatorSubscriptions", "mine"] as const;

export default function MySubscriptionsPage() {
  const queryClient = useQueryClient();
  const subscriptionsQuery = useQuery({ queryKey: mySubscriptionsQueryKey, queryFn: creatorSubscriptionsService.fetchMySubscriptions, retry: false });
  const refresh = () => queryClient.invalidateQueries({ queryKey: mySubscriptionsQueryKey });
  const cancel = useMutation({ mutationFn: creatorSubscriptionsService.cancelSubscription, onSuccess: refresh });
  const resume = useMutation({ mutationFn: creatorSubscriptionsService.resumeSubscription, onSuccess: refresh });
  const busyId = cancel.isPending ? cancel.variables : resume.isPending ? resume.variables : null;

  const confirmCancel = async (subscription: CreatorSubscriptionState) => {
    if (busyId) return;
    const accessUntil = formatSubscriptionDay(subscription.currentPeriodEnd);
    const confirmed = await requestConfirmation({
      title: "Stop renewing this subscription?",
      description: accessUntil ? `Your access continues until ${accessUntil}.` : "Your access continues until the end of the paid period.",
      confirmLabel: "Cancel subscription",
      cancelLabel: "Not now",
      tone: "danger",
      intent: "cancel",
    });
    if (confirmed) cancel.mutate(subscription.subscriptionId);
  };

  const subscriptions = subscriptionsQuery.data ?? [];
  return (
    <div className={styles.page}>
      <header className={styles.header}><h1 className={styles.title}>Subscriptions</h1></header>
      {subscriptionsQuery.isLoading ? <ListRowsSkeleton label="Loading subscriptions" rows={3} /> : null}
      {subscriptionsQuery.isError ? <ErrorState title="Couldn't load your subscriptions." error={subscriptionsQuery.error} onRetry={() => void subscriptionsQuery.refetch()} /> : null}
      {subscriptionsQuery.isSuccess && subscriptions.length === 0 ? (
        <EmptyState title="No subscriptions yet" description="Subscribe to a creator from their profile to unlock members-only posts." />
      ) : null}
      <ul className={styles.list}>
        {subscriptions.map((subscription) => (
          <SubscriptionCard
            key={subscription.subscriptionId}
            subscription={subscription}
            busy={busyId === subscription.subscriptionId}
            onCancel={() => void confirmCancel(subscription)}
            onResume={() => { if (!busyId) resume.mutate(subscription.subscriptionId); }}
          />
        ))}
      </ul>
      {cancel.isError ? <p className={styles.error} role="alert">{readErrorMessageForDisplay(cancel.error)}</p> : null}
      {resume.isError ? <p className={styles.error} role="alert">{readErrorMessageForDisplay(resume.error)}</p> : null}
    </div>
  );
}

function SubscriptionCard({ subscription, busy, onCancel, onResume }: { readonly subscription: CreatorSubscriptionState; readonly busy: boolean; readonly onCancel: () => void; readonly onResume: () => void }) {
  const creator = useQuery({ queryKey: ["user", subscription.creatorId], queryFn: () => usersService.fetchUserProfileById(subscription.creatorId), staleTime: 5 * 60_000, retry: false });
  const presentation = CREATOR_SUBSCRIPTION_STATUS_PRESENTATION[subscription.status];
  const renewsOn = formatSubscriptionDay(subscription.renewsAt ?? subscription.currentPeriodEnd);
  const channel = subscription.billingChannel ?? "web";
  const creatorName = creator.data?.name ?? "Creator";
  return (
    <li className={styles.card}>
      <div className={styles.row}>
        <Link href={`/user/${encodeURIComponent(subscription.creatorId)}`} className={styles.row}>
          <Avatar name={creatorName} src={creator.data?.avatarUrl ?? null} />
          <span className={styles.reasonText}>
            <strong>{creatorName}</strong>
            <span className={styles.faint}>{creator.data?.username ? `@${creator.data.username}` : "@"}</span>
          </span>
        </Link>
        <Badge tone={presentation.tone}>{presentation.label}</Badge>
      </div>
      <span>{formatMoneyForDisplay(subscription.price)} / {subscription.interval}</span>
      {renewsOn ? <span className={styles.muted}>{canCancelCreatorSubscription(subscription.status) ? `Renews ${renewsOn}` : `Ended ${renewsOn}`}</span> : null}
      {channel !== "web" ? (
        <a className={styles.link} href={STORE_SUBSCRIPTION_SETTINGS_URLS[channel]} target="_blank" rel="noopener noreferrer">
          {channel === "apple_iap" ? "Manage in the App Store" : "Manage in Google Play"}
        </a>
      ) : null}
      {channel === "web" && canCancelCreatorSubscription(subscription.status) ? <Button variant="secondary" busy={busy} onClick={onCancel}>Cancel subscription</Button> : null}
      {channel === "web" && canResumeCreatorSubscription(subscription.status) ? <Button busy={busy} onClick={onResume}>Resume subscription</Button> : null}
    </li>
  );
}
