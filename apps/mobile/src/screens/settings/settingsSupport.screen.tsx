import { Linking } from "react-native";

import { SettingsGroup, SettingsRow } from "@/components/settings/settingsGroup";
import { SettingsPage } from "@/components/settings/settingsPage";
import { Bug24Icon, ChatTeardropText24Icon, Flag24Icon, Lifebuoy24Icon, Question24Icon, Ticket24Icon } from "@/components/icons";
import { buildContactMailtoUrl } from "@/constants/contactEmails.constant";
import { useSupportUnreadCount } from "@/hooks/useSupportUnread.hook";
import type { MainScreenProps } from "@/navigation/navigation.types";

export function SettingsSupportScreen({ navigation }: MainScreenProps<"SettingsSupport">) {
  const unreadReplies = useSupportUnreadCount();
  return (
    <SettingsPage title="Support">
      <SettingsGroup>
        <SettingsRow label="Help centre" icon={<Question24Icon />} onPress={() => navigation.navigate("HelpCenter")} />
        <SettingsRow label="Contact support" icon={<Lifebuoy24Icon />} onPress={() => navigation.navigate("NewSupportTicket")} />
        <SettingsRow label="My support requests" icon={<Ticket24Icon />} trailing={unreadReplies > 0 ? { text: `${unreadReplies} new`, weight: 500 } : "chevron"} onPress={() => navigation.navigate("SupportTickets")} />
        <SettingsRow label="My reports" icon={<Flag24Icon />} onPress={() => navigation.navigate("MyReports")} />
        <SettingsRow label="Contact Us" icon={<ChatTeardropText24Icon />} trailing="external" onPress={() => Linking.openURL(buildContactMailtoUrl("Nantty support"))} />
        <SettingsRow
          label="Report a bug"
          icon={<Bug24Icon />}
          trailing="external"
          onPress={() => Linking.openURL(buildContactMailtoUrl("Bug report"))}
        />
      </SettingsGroup>
    </SettingsPage>
  );
}
