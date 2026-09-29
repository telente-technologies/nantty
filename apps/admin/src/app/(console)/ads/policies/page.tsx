import type { Metadata } from "next";

import { AdPoliciesWorkspace } from "@/components/trust/adPoliciesWorkspace";

export const metadata: Metadata = { title: "Ad policy categories" };

export default function AdPoliciesPage() {
  return <AdPoliciesWorkspace />;
}
