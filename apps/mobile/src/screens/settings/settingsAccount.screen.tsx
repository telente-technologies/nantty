import { useState } from "react";

import { useMyProfileQuery } from "@/components/profile/profileQueries.hook";
import { PhoneNumberSheet } from "@/components/settings/phoneNumberSheet";
import { SettingsCenteredAction, SettingsGroup, SettingsRow } from "@/components/settings/settingsGroup";
import { SettingsPage } from "@/components/settings/settingsPage";
import { useAccountSettingsQuery, useUpdateAccountSettingsMutation } from "@/components/settings/settingsQueries.hook";
import { colors } from "@/constants/colors.constant";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { usersService } from "@/services/users.service";
import { useAuthStore } from "@/store/auth.store";
import { showAlertWithButtons } from "@/utils/crossPlatformAlert.util";

export function SettingsAccountScreen({ navigation }: MainScreenProps<"SettingsAccount">) {
  const { data: profile } = useMyProfileQuery();
  const { data: settings } = useAccountSettingsQuery();
  const updateSettings = useUpdateAccountSettingsMutation();
  const clearSessionAndSignOut = useAuthStore((s) => s.clearSessionAndSignOut);
  const [phoneSheetVisible, setPhoneSheetVisible] = useState(false);

  const savePhoneNumberAndCloseSheet = (phone: string) =>
    updateSettings.mutate({ phone }, { onSuccess: () => setPhoneSheetVisible(false) });

  const confirmAndDeactivateAccount = () =>
    showAlertWithButtons("Deactivate account?", "Your profile and store will be hidden until you log in again.", [
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
        <SettingsRow label="Username" trailing={{ text: profile ? `@${profile.username}` : "", color: colors.textMuted, weight: 400 }} onPress={() => navigation.navigate("SettingsUsername")} />
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
