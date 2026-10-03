import type { Metadata } from "next";

import { SettlementsView } from "@/components/wallet/settlementsView";

export const metadata: Metadata = { title: "Settlements" };

export default function SettlementsPage() {
  return <SettlementsView />;
}
