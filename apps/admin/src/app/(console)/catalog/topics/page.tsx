import type { Metadata } from "next";

import { TopicsWorkspace } from "@/components/catalog/topicsWorkspace";

export const metadata: Metadata = { title: "Topics" };

export default function TopicsPage() {
  return <TopicsWorkspace />;
}
