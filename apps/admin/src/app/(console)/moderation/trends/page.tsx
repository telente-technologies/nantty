import type { Metadata } from "next";

import { TrendModerationWorkspace } from "@/components/ranking/trendModerationWorkspace";

export const metadata: Metadata = { title: "Trends & headlines" };

export default function TrendModerationPage() {
  return <TrendModerationWorkspace />;
}
