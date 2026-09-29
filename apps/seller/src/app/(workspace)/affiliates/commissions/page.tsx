import type { Metadata } from "next";

import { AffiliateCommissionsView } from "@/components/affiliates/affiliateCommissionsView";

export const metadata: Metadata = { title: "Commissions" };

export default function AffiliateCommissionsPage() {
  return <AffiliateCommissionsView />;
}
