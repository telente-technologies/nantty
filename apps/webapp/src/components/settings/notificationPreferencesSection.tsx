"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ErrorState } from "@/components/ui/feedback";
import { ListRowsSkeleton } from "@/components/ui/pageSkeletons";
import { showToast } from "@/components/ui/toast";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { notificationsService } from "@/services/notifications.service";
import { usersService } from "@/services/users.service";
import type { NotificationPreference } from "@/types/notificationPreference.type";
import type { AccountSettings } from "@/types/account.type";

import { ConsentToggleRow } from "./consentToggleRow";
import styles from "./settings.module.css";

const queryKey = ["notificationPreferences"] as const;
const accountSettingsKey = ["accountSettings"] as const;

const categoryTitles: Readonly<Record<string, string>> = {
  auth: "Account security",
  orders: "Orders",
  escrow: "Escrow",
  seller: "Seller activity",
  payments: "Payments",
  creator: "Creator program",
  checkmarks: "Verification",
  social: "Social activity",
  milestones: "Milestones",
  live: "Live",
  trust: "Trust and safety",
  privacy: "Privacy",
  support: "Support",
  marketing: "News and offers",
};

function titleForCategory(category: string) {
  return categoryTitles[category] ?? category.replace(/[-_]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function NotificationPreferencesSection() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey, queryFn: notificationsService.listPreferences, retry: false });
  const accountSettings = useQuery({ queryKey: accountSettingsKey, queryFn: usersService.fetchMyAccountSettings, retry: false });
  const updateAccountSettings = useMutation({
    mutationFn: (pushNotificationsEnabled: boolean) => usersService.updateMyAccountSettings({ pushNotificationsEnabled }),
    onSuccess: (settings) => queryClient.setQueryData<AccountSettings>(accountSettingsKey, settings),
    onError: (error) => showToast({ text: readErrorMessageForDisplay(error), tone: "error" }),
  });
  const update = useMutation({
    mutationFn: ({ category, ...change }: { category: string; push?: boolean; email?: boolean }) => notificationsService.updatePreference(category, change),
    onSuccess: (next) =>
      queryClient.setQueryData<NotificationPreference[]>(queryKey, (rows) => (rows ?? []).map((row) => (row.category === next.category ? next : row))),
    onError: (error) => showToast({ text: readErrorMessageForDisplay(error), tone: "error" }),
  });
  const heading = <h2 id="notification-categories-heading" className={styles.blockHeading}>Notification categories</h2>;
  return (
    <section aria-labelledby="notification-categories-heading" className={styles.block}>
      {heading}
      <p className={styles.muted}>Choose which categories can reach you by push or email. Security and privacy notices stay on.</p>
      {accountSettings.data ? (
        <ConsentToggleRow
          label="All push notifications"
          description="Master switch for push notifications on your Nantty account."
          enabled={accountSettings.data.pushNotificationsEnabled}
          disabled={updateAccountSettings.isPending}
          onChange={(enabled) => updateAccountSettings.mutate(enabled)}
        />
      ) : accountSettings.isError ? (
        <ErrorState description="We couldn't load your account-wide push setting." error={accountSettings.error} onRetry={() => void accountSettings.refetch()} />
      ) : null}
      {query.isLoading ? <ListRowsSkeleton label="Loading notification settings" rows={4} withAvatar={false} /> : null}
      {query.isError ? <ErrorState description="We couldn't load notification categories." error={query.error} onRetry={() => void query.refetch()} /> : null}
      {query.data?.map((row) => {
        const title = titleForCategory(row.category);
        const locked = row.locked;
        const pending = update.isPending && update.variables?.category === row.category;
        const push = pending && update.variables?.push !== undefined ? update.variables.push : row.push;
        const email = pending && update.variables?.email !== undefined ? update.variables.email : row.email;
        return (
          <div key={row.category} className={styles.notificationCategory}>
            <h3 className={styles.notificationCategoryHeading}>{title}</h3>
            <ConsentToggleRow
              label={`${title}: push`}
              description={`Push notifications about ${title.toLowerCase()}.`}
              enabled={push}
              disabled={update.isPending || locked}
              onChange={(enabled) => update.mutate({ category: row.category, push: enabled })}
            />
            <ConsentToggleRow
              label={`${title}: email`}
              description={`Email notifications about ${title.toLowerCase()}.`}
              enabled={email}
              disabled={update.isPending || locked}
              onChange={(enabled) => update.mutate({ category: row.category, email: enabled })}
            />
            {locked ? <p className={styles.muted}>Required account notices cannot be turned off.</p> : null}
          </div>
        );
      })}
    </section>
  );
}
