import type { Metadata } from "next";

import { TeamSettingsSummary } from "@/components/settings/teamSettingsSummary";

export const metadata: Metadata = { title: "Team" };

export default function TeamSettingsPage() {
  return <TeamSettingsSummary />;
}
