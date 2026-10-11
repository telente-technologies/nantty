"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ErrorState } from "@/components/ui/feedback";
import { ListRowsSkeleton } from "@/components/ui/pageSkeletons";
import { showToast } from "@/components/ui/toast";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { notificationsService } from "@/services/notifications.service";
import type { NotificationPreference } from "@/types/notificationPreference.type";

import { ConsentToggleRow } from "./consentToggleRow";
import styles from "./settings.module.css";

const queryKey = ["notificationPreferences"] as const;

export function NotificationPreferencesSection() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey, queryFn: notificationsService.listPreferences, retry: false });
  const update = useMutation({
    mutationFn: (change: { push?: boolean; email?: boolean }) => notificationsService.updatePreference("milestones", change),
    onSuccess: (next) =>
      queryClient.setQueryData<NotificationPreference[]>(queryKey, (rows) => (rows ?? []).map((row) => (row.category === next.category ? next : row))),
    onError: (error) => showToast({ text: readErrorMessageForDisplay(error), tone: "error" }),
  });
  const row = query.data?.find((item) => item.category === "milestones");
  const heading = <h2 id="milestones-notifications-heading" className={styles.blockHeading}>Milestones</h2>;
  if (query.isLoading || query.isError || !row) {
    if (query.isSuccess) return null;
    return (
      <section aria-labelledby="milestones-notifications-heading" className={styles.block}>
        {heading}
        {query.isLoading ? <ListRowsSkeleton label="Loading notification settings" rows={2} withAvatar={false} /> : <ErrorState description="We couldn't load your notification settings." error={query.error} onRetry={() => void query.refetch()} />}
      </section>
    );
  }
  return (
    <section aria-labelledby="milestones-notifications-heading" className={styles.block}>
      {heading}
      <ConsentToggleRow
        label="Push notifications"
        description="Birthdays and Zudoversaries, like your account anniversary."
        enabled={update.variables?.push ?? row.push}
        disabled={update.isPending}
        onChange={(push) => update.mutate({ push })}
      />
      <ConsentToggleRow
        label="Email"
        description="A celebration email on your Zudoversary."
        enabled={update.variables?.email ?? row.email}
        disabled={update.isPending}
        onChange={(email) => update.mutate({ email })}
      />
    </section>
  );
}
