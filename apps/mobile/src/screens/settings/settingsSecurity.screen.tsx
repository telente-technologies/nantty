import { useState } from "react";
import { Linking } from "react-native";

import { InfoSheet } from "@/components/settings/infoSheet";
import { SettingsGroup, SettingsRow } from "@/components/settings/settingsGroup";
import { SettingsPage } from "@/components/settings/settingsPage";
import { DownloadSimple24Icon, Fingerprint24Icon, LockKey24Icon, Prohibit24Icon } from "@/components/icons";
import { useAccountSettingsQuery, useUpdateAccountSettingsMutation } from "@/components/settings/settingsQueries.hook";
import { buildContactMailtoUrl, ZUDOMART_EMAIL_ADDRESSES } from "@/constants/contactEmails.constant";
import type { MainScreenProps } from "@/navigation/navigation.types";

export function SettingsSecurityScreen({ navigation }: MainScreenProps<"SettingsSecurity">) {
  const { data: settings } = useAccountSettingsQuery();
  const updateSettings = useUpdateAccountSettingsMutation();
  const [openSheet, setOpenSheet] = useState<"twoFactor" | "data" | null>(null);
  const twoFactorEnabled = settings?.twoFactorEnabled ?? false;

  return (
    <SettingsPage title="Security">
      <SettingsGroup>
        <SettingsRow label="Password" icon={<LockKey24Icon />} onPress={() => navigation.navigate("ChangePassword")} />
        <SettingsRow label="Blocked users" icon={<Prohibit24Icon />} onPress={() => navigation.navigate("BlockedUsers")} />
        <SettingsRow
          label="Two-factor authentication"
          icon={<Fingerprint24Icon />}
          trailing={settings ? { text: twoFactorEnabled ? "ON" : "OFF", weight: 400 } : "chevron"}
          onPress={settings ? () => setOpenSheet("twoFactor") : undefined}
        />
        <SettingsRow label="Data" icon={<DownloadSimple24Icon />} onPress={() => setOpenSheet("data")} />
      </SettingsGroup>
      <InfoSheet
        visible={openSheet === "twoFactor"}
        title="Two-factor authentication"
        message={
          twoFactorEnabled
            ? "2FA is on. We ask for a one-time code sent to your email whenever you log in on a new device."
            : "Add a one-time code, sent to your email, every time you log in on a new device."
        }
        actionTitle={twoFactorEnabled ? "Turn off 2FA" : "Turn on 2FA"}
        actionLoading={updateSettings.isPending}
        onAction={() => updateSettings.mutate({ twoFactorEnabled: !twoFactorEnabled }, { onSuccess: () => setOpenSheet(null) })}
        onClose={() => setOpenSheet(null)}
      />
      <InfoSheet
        visible={openSheet === "data"}
        title="Your data"
        message="Request a copy of the data Zudomart holds about you. We'll email it to the address on your account within 30 days."
        actionTitle="Request my data"
        onAction={() => {
          setOpenSheet(null);
          Linking.openURL(buildContactMailtoUrl("Data export request", ZUDOMART_EMAIL_ADDRESSES.privacy));
        }}
        onClose={() => setOpenSheet(null)}
      />
    </SettingsPage>
  );
}
