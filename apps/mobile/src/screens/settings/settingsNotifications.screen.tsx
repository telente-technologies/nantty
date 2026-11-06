import { Linking } from "react-native";
import { useState } from "react";

import { NotificationPreferenceRows } from "@/components/settings/notificationPreferenceRows";
import { SettingsGroup, SettingsRow } from "@/components/settings/settingsGroup";
import { SettingsPage } from "@/components/settings/settingsPage";
import { BellRinging24Icon, GearSix24Icon } from "@/components/icons";
import { useAccountSettingsQuery, useUpdateAccountSettingsMutation } from "@/components/settings/settingsQueries.hook";
import { ErrorState } from "@/components/ui/errorState";
import { usePullToRefresh } from "@/components/ui/pullToRefresh.hook";
import { showToast } from "@/store/toast.store";
import { disableAccountPushNotifications, enableAccountPushNotifications } from "@/services/widgets/widgetPush.service";
import { useTheme } from "@/theme";

export function SettingsNotificationsScreen() {
  const { colors } = useTheme();
  const settingsQuery = useAccountSettingsQuery();
  const settings = settingsQuery.data;
  const refreshControl = usePullToRefresh(settingsQuery.refetch);
  const updateSettings = useUpdateAccountSettingsMutation();
  const [isChangingPush, setIsChangingPush] = useState(false);
  const pushEnabled = settings?.pushNotificationsEnabled ?? false;

  const changePushPreference = async () => {
    if (!settings || isChangingPush || updateSettings.isPending) return;
    setIsChangingPush(true);
    try {
      if (pushEnabled) {
        await disableAccountPushNotifications((enabled) => updateSettings.mutateAsync({ pushNotificationsEnabled: enabled }));
        return;
      }

      const permission = await enableAccountPushNotifications((enabled) => updateSettings.mutateAsync({ pushNotificationsEnabled: enabled }));
      if (permission === "denied") {
        showToast("Notifications are off for Nantty on this device. You can enable them in system settings.", { tone: "error" });
        return;
      }
    } catch {
      showToast("Couldn't update push notifications. Please try again.", { tone: "error" });
    } finally {
      setIsChangingPush(false);
    }
  };

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
          onPress={settings && !updateSettings.isPending && !isChangingPush ? () => void changePushPreference() : undefined}
        />
        <SettingsRow label="System notification settings" icon={<GearSix24Icon />} trailing="external" onPress={() => Linking.openSettings()} />
      </SettingsGroup>
      <NotificationPreferenceRows />
    </SettingsPage>
  );
}
