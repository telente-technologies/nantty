import type { Metadata } from "next";

import { LiveIncidentsWorkspace } from "@/components/trust/liveIncidentsWorkspace";

export const metadata: Metadata = { title: "Live incidents" };

export default function ModerationLiveIncidentsPage() {
  return <LiveIncidentsWorkspace />;
}
