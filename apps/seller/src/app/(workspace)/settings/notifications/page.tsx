import type { Metadata } from "next";

import { NotificationSettingsView } from "@/components/settings/notificationSettingsForm";

export const metadata: Metadata = { title: "Notifications" };

export default function NotificationSettingsPage() {
  return <NotificationSettingsView />;
}
