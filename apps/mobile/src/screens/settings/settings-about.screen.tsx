import Constants from "expo-constants";
import { Linking } from "react-native";

import { SettingsGroup, SettingsRow } from "@/components/settings/settingsGroup";
import { SettingsPage } from "@/components/settings/settingsPage";
import { colors } from "@/constants/colors.constant";

export function SettingsAboutScreen() {
  return (
    <SettingsPage title="About">
      <SettingsGroup>
        <SettingsRow label="Terms of Service" onPress={() => Linking.openURL("https://zudomart.com/terms")} />
        <SettingsRow label="Privacy Policy" onPress={() => Linking.openURL("https://zudomart.com/privacy")} />
        <SettingsRow label="Version" trailing={{ text: Constants.expoConfig?.version ?? "1.0.0", color: colors.text }} />
      </SettingsGroup>
    </SettingsPage>
  );
}
