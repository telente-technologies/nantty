import type { Metadata } from "next";

import { WithdrawView } from "@/components/wallet/withdrawView";

export const metadata: Metadata = { title: "Withdraw" };

export default function WithdrawPage() {
  return <WithdrawView />;
}
