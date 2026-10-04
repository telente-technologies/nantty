import type { Metadata } from "next";

import { FeedRankingWorkspace } from "@/components/ranking/feedRankingWorkspace";

export const metadata: Metadata = { title: "Feed ranking" };

export default function FeedRankingPage() {
  return <FeedRankingWorkspace />;
}
