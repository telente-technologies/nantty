import { Linking } from "react-native";

import { SettingsGroup, SettingsRow } from "@/components/settings/settingsGroup";
import { SettingsPage } from "@/components/settings/settingsPage";
import type { MainScreenProps } from "@/navigation/navigation.types";

export function SettingsSupportScreen({ navigation }: MainScreenProps<"SettingsSupport">) {
  return (
    <SettingsPage title="Support">
      <SettingsGroup>
        <SettingsRow label="Contact support" onPress={() => navigation.navigate("NewSupportTicket")} />
        <SettingsRow label="My support requests" onPress={() => navigation.navigate("SupportTickets")} />
        <SettingsRow label="My reports" onPress={() => navigation.navigate("MyReports")} />
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
