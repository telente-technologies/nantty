import type { Metadata } from "next";

import { AutomationWorkspace } from "@/components/configuration/automation/automationWorkspace";

export const metadata: Metadata = { title: "Automation" };

export default function AutomationPage() {
  return <AutomationWorkspace />;
}
