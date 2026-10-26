"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import styles from "@/components/settings/settings.module.css";
import { SelectField } from "@/components/ui/field";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { Card, Muted, pageStyles } from "@/components/ui/studioPage";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { settingsService } from "@/services/settings.service";
import type { ContactPrivacy, NotificationCategory, NotificationPreference, WhoCanMention, WhoCanMessage } from "@/types/studioSocial.type";

const CATEGORY_COPY: Partial<Record<NotificationCategory, { readonly label: string; readonly detail: string }>> = {
  creator: { label: "Creator Program", detail: "Tier changes, reviews and program news." },
  live: { label: "Lives", detail: "Gifts during your lives and lives from people you follow." },
  social: { label: "Comments, mentions and follows", detail: "New followers, comments and mentions on your posts." },
  payments: { label: "Payouts and earnings", detail: "Payouts sent, failed or held." },
  milestones: { label: "Milestones", detail: "Follower and earnings milestones." },
  marketing: { label: "Tips and offers", detail: "Product news and creator tips from Nantty." },
  trust: { label: "Account safety", detail: "Strikes, appeals and copyright notices. Always on." },
  privacy: { label: "Privacy", detail: "Data exports and privacy changes." },
  support: { label: "Support", detail: "Replies to your support tickets." },
};

const MENTION_OPTIONS: readonly { readonly value: WhoCanMention; readonly label: string }[] = [
  { value: "everyone", label: "Everyone" },
  { value: "following", label: "People you follow" },
  { value: "no_one", label: "No one" },
];

const MESSAGE_OPTIONS: readonly { readonly value: WhoCanMessage; readonly label: string }[] = [
  { value: "everyone", label: "Everyone" },
  { value: "followers", label: "Your followers" },
  { value: "following", label: "People you follow" },
  { value: "nobody", label: "No one" },
];

const PREFERENCES_KEY = ["settings", "notification-preferences"];
const PRIVACY_KEY = ["settings", "contact-privacy"];

function NotificationsCard() {
  const queryClient = useQueryClient();
  const preferences = useQuery({ queryKey: PREFERENCES_KEY, queryFn: settingsService.listNotificationPreferences });
  const update = useMutation({
    mutationFn: ({ category, change }: { readonly category: NotificationCategory; readonly change: { readonly push?: boolean; readonly email?: boolean } }) => settingsService.updateNotificationPreference(category, change),
    onMutate: async ({ category, change }) => {
      await queryClient.cancelQueries({ queryKey: PREFERENCES_KEY });
      const previous = queryClient.getQueryData<NotificationPreference[]>(PREFERENCES_KEY);
      queryClient.setQueryData<NotificationPreference[]>(PREFERENCES_KEY, (current) => current?.map((entry) => (entry.category === category ? { ...entry, ...change } : entry)));
      return { previous };
    },
    onError: (_error, _input, context) => queryClient.setQueryData(PREFERENCES_KEY, context?.previous),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: PREFERENCES_KEY }),
  });

  if (preferences.isError) return <ErrorState title="Notification settings didn't load" error={preferences.error} onRetry={() => void preferences.refetch()} />;
  const rows = (preferences.data ?? []).filter((entry) => CATEGORY_COPY[entry.category]);
  return (
    <Card title="Notifications">
      <Muted>Choose how Nantty tells you about activity on your channel. In-app notifications always stay in your inbox.</Muted>
      {preferences.isLoading ? <Skeleton height={200} /> : (
        <ul className={styles.toggleList}>
          <li className={styles.toggleRow} aria-hidden="true">
            <span className={styles.toggleHead}>Category</span>
            <span className={`${styles.toggleHead} ${styles.check}`}>Push</span>
            <span className={`${styles.toggleHead} ${styles.check}`}>Email</span>
          </li>
          {rows.map((entry) => {
            const copy = CATEGORY_COPY[entry.category]!;
            return (
              <li key={entry.category} className={styles.toggleRow}>
                <span className={styles.toggleLabel}>
                  {copy.label}
                  <span className={styles.toggleDetail}>{copy.detail}</span>
                </span>
                {(["push", "email"] as const).map((channel) => (
                  <label key={channel} className={styles.check}>
                    <input type="checkbox" checked={entry[channel]} disabled={entry.locked} aria-label={`${copy.label}: ${channel === "push" ? "push notifications" : "email"}`} onChange={(event) => update.mutate({ category: entry.category, change: { [channel]: event.target.checked } })} />
                  </label>
                ))}
              </li>
            );
          })}
        </ul>
      )}
      {update.isError ? <p className={styles.error} role="alert">{`That change wasn't saved. ${readErrorMessageForDisplay(update.error)}`}</p> : null}
    </Card>
  );
}

function PrivacyCard() {
  const queryClient = useQueryClient();
  const privacy = useQuery({ queryKey: PRIVACY_KEY, queryFn: settingsService.fetchContactPrivacy });
  const save = useMutation({
    mutationFn: async (change: Partial<ContactPrivacy>) => {
      if (change.whoCanMentionMe) await settingsService.updateMentionPrivacy(change.whoCanMentionMe);
      if (change.whoCanMessageMe) await settingsService.updateMessagePrivacy(change.whoCanMessageMe);
      return change;
    },
    onSuccess: (change) => queryClient.setQueryData<ContactPrivacy>(PRIVACY_KEY, (current) => (current ? { ...current, ...change } : current)),
  });

  if (privacy.isError) return <ErrorState title="Privacy settings didn't load" error={privacy.error} onRetry={() => void privacy.refetch()} />;
  if (!privacy.data) return <Card title="Privacy"><Skeleton height={140} /></Card>;
  return (
    <Card title="Privacy">
      <SelectField label="Who can mention you" hint="Applies to posts, comments and live chat." value={privacy.data.whoCanMentionMe} disabled={save.isPending} onChange={(event) => save.mutate({ whoCanMentionMe: event.target.value as WhoCanMention })}>
        {MENTION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </SelectField>
      <SelectField label="Who can message you" hint="Others can still send a message request you can accept." value={privacy.data.whoCanMessageMe} disabled={save.isPending} onChange={(event) => save.mutate({ whoCanMessageMe: event.target.value as WhoCanMessage })}>
        {MESSAGE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </SelectField>
      {save.isSuccess ? <p className={styles.status} role="status">Saved</p> : null}
      {save.isError ? <p className={styles.error} role="alert">{readErrorMessageForDisplay(save.error)}</p> : null}
    </Card>
  );
}

export default function GeneralSettingsPage() {
  return (
    <div className={pageStyles.columns}>
      <NotificationsCard />
      <PrivacyCard />
    </div>
  );
}
