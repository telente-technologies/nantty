import type { Metadata } from "next";

import { AppearanceSection } from "@/components/settings/appearanceSection";
import { NotificationPreferencesSection } from "@/components/settings/notificationPreferencesSection";
import { SettingsLinkGroups } from "@/components/settings/settingsLinkGroups";
import styles from "@/components/settings/settingsHome.module.css";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Settings</h1>
      <SettingsLinkGroups />
      <div id="notification-settings">
        <NotificationPreferencesSection />
      </div>
      <div id="app-preference">
        <AppearanceSection />
      </div>
    </div>
  );
}
