import type { Metadata } from "next";

import { MarketingOverviewView } from "@/components/marketing/marketingOverviewView";

export const metadata: Metadata = { title: "Marketing" };

export default function MarketingPage() {
  return <MarketingOverviewView />;
}
