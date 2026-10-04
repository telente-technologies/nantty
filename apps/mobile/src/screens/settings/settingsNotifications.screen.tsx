import { Linking } from "react-native";

import { MilestonesPreferenceRows } from "@/components/settings/milestonesPreferenceRows";
import { SettingsGroup, SettingsRow } from "@/components/settings/settingsGroup";
import { SettingsPage } from "@/components/settings/settingsPage";
import { useAccountSettingsQuery, useUpdateAccountSettingsMutation } from "@/components/settings/settingsQueries.hook";
import { useTheme } from "@/theme";

export function SettingsNotificationsScreen() {
  const { colors } = useTheme();
  const { data: settings } = useAccountSettingsQuery();
  const updateSettings = useUpdateAccountSettingsMutation();
  const pushEnabled = settings?.pushNotificationsEnabled ?? true;

  return (
    <SettingsPage title="Notifications">
      <SettingsGroup>
        <SettingsRow
          label="Push notifications"
          trailing={{ text: pushEnabled ? "ON" : "OFF", color: pushEnabled ? colors.primary : colors.textSubtle }}
          accessibilityHint="Turns push notifications on or off"
          onPress={() => updateSettings.mutate({ pushNotificationsEnabled: !pushEnabled })}
        />
        <SettingsRow label="In-app per category" trailing={{ text: "Set Up" }} onPress={() => Linking.openSettings()} />
      </SettingsGroup>
      <MilestonesPreferenceRows />
    </SettingsPage>
  );
}
