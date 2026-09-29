import type { Metadata } from "next";

import { AffiliateCreatorsView } from "@/components/affiliates/affiliateCreatorsView";

export const metadata: Metadata = { title: "Creators" };

export default function AffiliateCreatorsPage() {
  return <AffiliateCreatorsView />;
}
