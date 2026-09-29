import { Linking } from "react-native";

import { SettingsGroup, SettingsRow } from "@/components/settings/settingsGroup";
import { SettingsPage } from "@/components/settings/settingsPage";

export function SettingsSupportScreen() {
  return (
    <SettingsPage title="Support">
      <SettingsGroup>
        <SettingsRow label="FAQs" onPress={() => Linking.openURL("https://zudomart.com/faq")} />
        <SettingsRow label="Contact Us" trailing="external" onPress={() => Linking.openURL("mailto:support@zudomart.com")} />
        <SettingsRow
          label="Report a bug"
          trailing="external"
          onPress={() => Linking.openURL("mailto:support@zudomart.com?subject=Bug%20report")}
        />
      </SettingsGroup>
    </SettingsPage>
  );
}
