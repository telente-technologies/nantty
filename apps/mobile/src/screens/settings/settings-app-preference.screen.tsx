import { Linking } from "react-native";

import { SettingsGroup, SettingsRow } from "@/components/settings/settingsGroup";
import { SettingsPage } from "@/components/settings/settingsPage";

export function SettingsAppPreferenceScreen() {
  return (
    <SettingsPage title="App Preference">
      <SettingsGroup>
        <SettingsRow label="Theme" trailing={{ text: "Light Mode" }} />
        <SettingsRow label="Language" trailing={{ text: "English" }} />
        <SettingsRow label="Accessibility" onPress={() => Linking.openSettings()} />
      </SettingsGroup>
    </SettingsPage>
  );
}
