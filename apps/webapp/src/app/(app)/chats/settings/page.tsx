"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";

import { ConsentToggleRow } from "@/components/settings/consentToggleRow";
import settingsStyles from "@/components/settings/settings.module.css";
import { ErrorState } from "@/components/ui/feedback";
import { RetryButton } from "@/components/ui/controls";
import { ChatMessagesSkeleton } from "@/components/ui/pageSkeletons";
import { chatSettingsService } from "@/services/chatGroups.service";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import type { ChatNotificationSettings, ChatSettings, MessageRequestAudience } from "@/types";

const audienceOptions: readonly { readonly value: MessageRequestAudience; readonly label: string }[] = [
  { value: "everyone", label: "Everyone" },
  { value: "following", label: "People I follow" },
  { value: "followers", label: "Followers" },
  { value: "nobody", label: "Nobody" },
];

const notificationRows: readonly { readonly key: keyof ChatNotificationSettings; readonly label: string; readonly description: string }[] = [
  { key: "messages", label: "Messages", description: "Direct messages and store chats." },
  { key: "groups", label: "Groups", description: "New messages in your groups." },
  { key: "requests", label: "Message requests", description: "When someone new asks to message you." },
  { key: "streakReminders", label: "Streak reminders", description: "Before a chat streak ends." },
  { key: "showMessagePreview", label: "Show previews", description: "Show the sender's name in notifications. Message text never leaves your devices." },
];

const settingsKey = ["chat", "settings"] as const;

export default function ChatSettingsPage() {
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: settingsKey, queryFn: chatSettingsService.fetch });
  const update = useMutation({
    mutationFn: chatSettingsService.update,
    onMutate: async (change) => {
      const previous = queryClient.getQueryData<ChatSettings>(settingsKey);
      if (previous) queryClient.setQueryData<ChatSettings>(settingsKey, { messageRequestsFrom: change.messageRequestsFrom ?? previous.messageRequestsFrom, notifications: { ...previous.notifications, ...change.notifications } });
      return { previous };
    },
    onError: (_error, _change, context) => {
      if (context?.previous) queryClient.setQueryData(settingsKey, context.previous);
    },
    onSuccess: (saved) => queryClient.setQueryData(settingsKey, saved),
  });

  if (settings.isPending) return <ChatMessagesSkeleton label="Loading chat settings" />;
  if (settings.isError) return <ErrorState description="Couldn't load chat settings." action={<RetryButton onRetry={() => settings.refetch()} />} />;
  const data = settings.data;
  return (
    <div className={settingsStyles.page}>
      <h1 className={settingsStyles.title}>Chat settings</h1>
      <section className={settingsStyles.block}>
        <h2 className={settingsStyles.blockHeading}>Who can send you message requests</h2>
        <fieldset className={settingsStyles.radioGroup}>
          <legend className="visuallyHidden">Who can send you message requests</legend>
          {audienceOptions.map((option) => (
            <label key={option.value} className={settingsStyles.radioRow}>
              <input type="radio" name="messageRequestsFrom" checked={data.messageRequestsFrom === option.value} onChange={() => update.mutate({ messageRequestsFrom: option.value })} />
              <span>{option.label}</span>
            </label>
          ))}
        </fieldset>
      </section>
      <section className={settingsStyles.block}>
        <h2 className={settingsStyles.blockHeading}>Notifications</h2>
        {notificationRows.map((row) => (
          <ConsentToggleRow key={row.key} label={row.label} description={row.description} enabled={data.notifications[row.key]} onChange={(enabled) => update.mutate({ notifications: { [row.key]: enabled } })} />
        ))}
      </section>
      <section className={settingsStyles.block}>
        <Link href="/settings/security" className={settingsStyles.downloadLink}>Blocked accounts</Link>
        <p className={settingsStyles.muted}>Photos, videos and voice notes in chats are deleted automatically 30 days after they are sent.</p>
        <p className={settingsStyles.muted}>Messages, locations, polls, reactions and group names are end-to-end encrypted. Only you and the people in the chat can read them.</p>
      </section>
      {update.isError ? <p className={settingsStyles.errorText} role="alert">{readErrorMessageForDisplay(update.error)}</p> : null}
    </div>
  );
}
