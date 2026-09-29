import type { Metadata } from "next";

import { BillingGateView } from "@/components/billing/billingGateView";

export const metadata: Metadata = { title: "Choose your Gold plan" };

export default function BillingGatePage() {
  return <BillingGateView />;
}
