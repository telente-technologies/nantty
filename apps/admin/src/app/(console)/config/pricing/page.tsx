import type { Metadata } from "next";

import { RegionalPricingWorkspace } from "@/components/configuration/pricing/regionalPricingWorkspace";

export const metadata: Metadata = { title: "Regional pricing" };

export default function RegionalPricingPage() {
  return <RegionalPricingWorkspace />;
}
