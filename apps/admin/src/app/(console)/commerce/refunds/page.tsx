import type { Metadata } from "next";

import { RefundsWorkspace } from "@/components/money/refundsWorkspace";

export const metadata: Metadata = { title: "Refunds" };

export default function RefundsPage() {
  return <RefundsWorkspace />;
}
