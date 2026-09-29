import { useState } from "react";
import { Alert } from "react-native";

import { PhoneNumberSheet } from "@/components/settings/phoneNumberSheet";
import { SettingsCenteredAction, SettingsGroup, SettingsRow } from "@/components/settings/settingsGroup";
import { SettingsPage } from "@/components/settings/settingsPage";
import { useAccountSettingsQuery, useUpdateAccountSettingsMutation } from "@/components/settings/settingsQueries.hook";
import { colors } from "@/constants/colors.constant";
import { usersService } from "@/services/users.service";
import { useAuthStore } from "@/store/auth.store";

export function SettingsAccountScreen() {
  const { data: settings } = useAccountSettingsQuery();
  const updateSettings = useUpdateAccountSettingsMutation();
  const clearSessionAndSignOut = useAuthStore((s) => s.clearSessionAndSignOut);
  const [phoneSheetVisible, setPhoneSheetVisible] = useState(false);

  const savePhoneNumberAndCloseSheet = (phone: string) =>
    updateSettings.mutate({ phone }, { onSuccess: () => setPhoneSheetVisible(false) });

  const confirmAndDeactivateAccount = () =>
    Alert.alert("Deactivate account?", "Your profile and store will be hidden until you log in again.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Deactivate",
        style: "destructive",
        onPress: async () => {
          await usersService.deactivateMyAccount();
          await clearSessionAndSignOut();
        },
      },
    ]);

  return (
    <SettingsPage title="Account">
      <SettingsGroup>
        <SettingsRow label="Email" trailing={{ text: settings?.email ?? "", color: colors.textMuted, weight: 400 }} />
        <SettingsRow
          label="Phone number"
          trailing={{ text: settings?.phone ?? "Set Up" }}
          onPress={() => setPhoneSheetVisible(true)}
        />
      </SettingsGroup>
      <SettingsCenteredAction label="Deactivate account" onPress={confirmAndDeactivateAccount} />
      <PhoneNumberSheet
        key={settings?.phone ?? "none"}
        visible={phoneSheetVisible}
        initialPhone={settings?.phone ?? null}
        saving={updateSettings.isPending}
        onClose={() => setPhoneSheetVisible(false)}
        onSave={savePhoneNumberAndCloseSheet}
      />
    </SettingsPage>
  );
}
