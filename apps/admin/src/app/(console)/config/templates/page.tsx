import type { Metadata } from "next";

import { TemplatesWorkspace } from "@/components/configuration/templates/templatesWorkspace";

export const metadata: Metadata = { title: "Notification templates" };

export default function NotificationTemplatesPage() {
  return <TemplatesWorkspace />;
}
