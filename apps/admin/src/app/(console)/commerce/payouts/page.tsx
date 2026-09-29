import type { Metadata } from "next";

import { PayoutsWorkspace } from "@/components/money/payoutsWorkspace";

export const metadata: Metadata = { title: "Payouts" };

export default function PayoutsPage() {
  return <PayoutsWorkspace />;
}
