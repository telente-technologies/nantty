import { SettingToggleRow } from "@/components/chatSafety/settingToggleRow";
import { useChatSettingsQuery, useUpdateChatSettingsMutation } from "@/components/chatSafety/chatSettings.hook";
import { SettingsGroup } from "@/components/settings/settingsGroup";
import { SettingsPage } from "@/components/settings/settingsPage";
import { ErrorState } from "@/components/ui/errorState";
import { ListSkeleton } from "@/components/ui/listSkeleton";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";
import type { ChatNotificationSettings } from "@/types";

type BooleanSettingKey = { [Key in keyof ChatNotificationSettings]: ChatNotificationSettings[Key] extends boolean ? Key : never }[keyof ChatNotificationSettings];

const TOGGLES: readonly { readonly key: BooleanSettingKey; readonly label: string; readonly description?: string }[] = [
  { key: "messages", label: "Messages" },
  { key: "requests", label: "Message requests" },
  { key: "groups", label: "Groups and channels" },
  { key: "streakReminders", label: "Streak reminders", description: "A nudge 4 hours before your day ends if a streak is at risk" },
  { key: "sound", label: "Notification sounds" },
  { key: "vibration", label: "Vibration" },
  { key: "showMessagePreview", label: "Show message preview", description: "Show the sender and text in notifications" },
];

export function ChatNotificationSettingsScreen() {
  const { colors } = useTheme();
  const settings = useChatSettingsQuery();
  const updateSettings = useUpdateChatSettingsMutation();
  return (
    <SettingsPage title="Chat notifications" contentTopSpacing={24} gap={16}>
      {settings.isLoading ? (
        <ListSkeleton rows={5} avatarSize={24} />
      ) : settings.isError || !settings.data ? (
        <ErrorState error={settings.error} message="Couldn't load notification settings." onRetry={() => settings.refetch()} />
      ) : (
        <>
          <SettingsGroup>
            {TOGGLES.map((toggle) => (
              <SettingToggleRow
                key={toggle.key}
                label={toggle.label}
                description={toggle.description}
                value={settings.data.notifications[toggle.key]}
                disabled={updateSettings.isPending}
                onValueChange={(value) => updateSettings.mutate({ notifications: { ...settings.data.notifications, [toggle.key]: value } })}
              />
            ))}
          </SettingsGroup>
          <Text size={12} lineHeight={17} color={colors.textMuted}>
            To silence a single chat, tap the bell in its header and mute it for 8 hours, 1 week or always.
          </Text>
        </>
      )}
    </SettingsPage>
  );
}
