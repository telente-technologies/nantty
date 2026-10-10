import type { Metadata } from "next";

import { WithdrawalsWorkspace } from "@/components/money/withdrawalsWorkspace";

export const metadata: Metadata = { title: "Withdrawals" };

export default function WithdrawalsPage() {
  return <WithdrawalsWorkspace />;
}
