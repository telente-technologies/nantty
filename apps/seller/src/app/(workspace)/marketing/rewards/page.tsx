import type { Metadata } from "next";

import { StoreRewardsView } from "@/components/marketing/storeRewardsView";

export const metadata: Metadata = { title: "Store rewards" };

export default function MarketingRewardsPage() {
  return <StoreRewardsView />;
}
