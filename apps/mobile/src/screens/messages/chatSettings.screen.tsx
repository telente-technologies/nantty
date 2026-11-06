import { useNavigation } from "@react-navigation/native";
import { useEffect } from "react";
import { StyleSheet } from "react-native";

import { ChatLockGate } from "@/components/chatSafety/chatLockGate";
import { useChatSettingsQuery, useUpdateChatSettingsMutation } from "@/components/chatSafety/chatSettings.hook";
import { GroupInvitationPrivacyRow } from "@/components/chatSafety/groupInvitationPrivacyRow";
import { SettingsGroup, SettingsRow } from "@/components/settings/settingsGroup";
import { SettingsPage } from "@/components/settings/settingsPage";
import { ErrorState } from "@/components/ui/errorState";
import { ListSkeleton } from "@/components/ui/listSkeleton";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";
import { useChatLockStore } from "@/store/chatLock.store";
import type { MessageRequestAudience } from "@/types";

const AUDIENCE_OPTIONS: readonly { readonly value: MessageRequestAudience; readonly label: string }[] = [
  { value: "everyone", label: "Everyone" },
  { value: "following", label: "People I follow" },
  { value: "followers", label: "Followers" },
  { value: "nobody", label: "Nobody" },
];

export function ChatSettingsScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const settings = useChatSettingsQuery();
  const updateSettings = useUpdateChatSettingsMutation();
  const { isPasscodeSet, refreshPasscodeFlag } = useChatLockStore();

  useEffect(() => {
    refreshPasscodeFlag().catch(() => undefined);
  }, [refreshPasscodeFlag]);

  return (
    <ChatLockGate>
      <SettingsPage title="Chat settings" contentTopSpacing={24} gap={32}>
        {settings.isLoading ? (
          <ListSkeleton rows={4} avatarSize={24} />
        ) : settings.isError || !settings.data ? (
          <ErrorState error={settings.error} message="Couldn't load chat settings." onRetry={() => settings.refetch()} />
        ) : (
          <>
            <SettingsGroup>
              <Text size={13} weight={600} lineHeight={18} style={styles.groupTitle}>Who can send you message requests</Text>
              {AUDIENCE_OPTIONS.map((option) => (
                <SettingsRow
                  key={option.value}
                  label={option.label}
                  trailing={settings.data.messageRequestsFrom === option.value ? { text: "Selected" } : "none"}
                  onPress={() => updateSettings.mutate({ messageRequestsFrom: option.value })}
                />
              ))}
            </SettingsGroup>
            <SettingsGroup>
              <GroupInvitationPrivacyRow
                enabled={settings.data.preventDirectGroupAdds}
                disabled={updateSettings.isPending}
                hasError={updateSettings.isError}
                onChange={(value) => updateSettings.mutate({ preventDirectGroupAdds: value })}
              />
            </SettingsGroup>
            <SettingsGroup>
              <SettingsRow label="Chat passcode" trailing={{ text: isPasscodeSet ? "On" : "Off", color: isPasscodeSet ? colors.primary : colors.textSubtle }} onPress={() => navigation.navigate("ChatPasscode")} />
              <SettingsRow label="Push notifications" onPress={() => navigation.navigate("ChatNotificationSettings")} />
              <SettingsRow label="Blocked accounts" onPress={() => navigation.navigate("BlockedUsers")} />
            </SettingsGroup>
            <Text size={12} lineHeight={17} color={colors.textMuted} accessibilityRole="text">
              Photos, videos and voice notes in chats are deleted automatically 30 days after they are sent. Your text messages are kept.
            </Text>
            <Text size={12} lineHeight={17} color={colors.textMuted}>
              Messages are end-to-end encrypted. Only you and the people in the chat can read them.
            </Text>
          </>
        )}
      </SettingsPage>
    </ChatLockGate>
  );
}

const styles = StyleSheet.create({ groupTitle: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 } });
