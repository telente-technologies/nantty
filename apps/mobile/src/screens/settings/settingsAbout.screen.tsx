import Constants from "expo-constants";

import { inAppBrowserColorsFromTheme, openTrustedWebPage } from "@/components/links/openLink.util";
import { SettingsGroup, SettingsRow } from "@/components/settings/settingsGroup";
import { SettingsPage } from "@/components/settings/settingsPage";
import { useTheme } from "@/theme";

export function SettingsAboutScreen() {
  const { colors } = useTheme();
  return (
    <SettingsPage title="About">
      <SettingsGroup>
        <SettingsRow label="Terms of Service" onPress={() => openTrustedWebPage("https://zudomart.com/terms", inAppBrowserColorsFromTheme(colors))} />
        <SettingsRow label="Privacy Policy" onPress={() => openTrustedWebPage("https://zudomart.com/privacy", inAppBrowserColorsFromTheme(colors))} />
        <SettingsRow label="Version" trailing={{ text: Constants.expoConfig?.version ?? "1.0.0", color: colors.text }} />
      </SettingsGroup>
    </SettingsPage>
  );
}
