import type { Metadata } from "next";

import { PayoutAccountsView } from "@/components/wallet/payoutAccountsView";

export const metadata: Metadata = { title: "Payout accounts" };

export default function PayoutAccountsPage() {
  return <PayoutAccountsView />;
}
