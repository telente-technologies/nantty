import type { Metadata } from "next";

import { AffiliateOverviewView } from "@/components/affiliates/affiliateOverviewView";

export const metadata: Metadata = { title: "Affiliates" };

export default function AffiliateOverviewPage() {
  return <AffiliateOverviewView />;
}
