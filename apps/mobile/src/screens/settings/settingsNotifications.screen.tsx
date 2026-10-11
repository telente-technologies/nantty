import { Linking } from "react-native";

import { MilestonesPreferenceRows } from "@/components/settings/milestonesPreferenceRows";
import { SettingsGroup, SettingsRow } from "@/components/settings/settingsGroup";
import { SettingsPage } from "@/components/settings/settingsPage";
import { BellRinging24Icon, GearSix24Icon } from "@/components/icons";
import { useAccountSettingsQuery, useUpdateAccountSettingsMutation } from "@/components/settings/settingsQueries.hook";
import { ErrorState } from "@/components/ui/errorState";
import { usePullToRefresh } from "@/components/ui/pullToRefresh.hook";
import { useTheme } from "@/theme";

export function SettingsNotificationsScreen() {
  const { colors } = useTheme();
  const settingsQuery = useAccountSettingsQuery();
  const settings = settingsQuery.data;
  const refreshControl = usePullToRefresh(settingsQuery.refetch);
  const updateSettings = useUpdateAccountSettingsMutation();
  const pushEnabled = settings?.pushNotificationsEnabled ?? false;

  return (
    <SettingsPage title="Notifications" refreshControl={refreshControl}>
      {settingsQuery.isError && !settings ? (
        <ErrorState error={settingsQuery.error} compact message="Couldn't load your notification settings." onRetry={() => settingsQuery.refetch()} retrying={settingsQuery.isRefetching} />
      ) : null}
      <SettingsGroup>
        <SettingsRow
          label="Push notifications"
          icon={<BellRinging24Icon />}
          trailing={settings ? { text: pushEnabled ? "ON" : "OFF", color: pushEnabled ? colors.primary : colors.textSubtle } : { text: "…", color: colors.textSubtle }}
          accessibilityHint="Turns push notifications on or off"
          onPress={settings && !updateSettings.isPending ? () => updateSettings.mutate({ pushNotificationsEnabled: !pushEnabled }) : undefined}
        />
        <SettingsRow label="System notification settings" icon={<GearSix24Icon />} trailing="external" onPress={() => Linking.openSettings()} />
      </SettingsGroup>
      <MilestonesPreferenceRows />
    </SettingsPage>
  );
}
