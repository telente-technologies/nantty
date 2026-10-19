import type { Metadata } from "next";

import { AdCreditWorkspace } from "@/components/adCredit/adCreditWorkspace";

export const metadata: Metadata = { title: "Ad credit" };

export default function AdCreditPage() {
  return <AdCreditWorkspace />;
}
