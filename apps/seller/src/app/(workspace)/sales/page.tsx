import type { Metadata } from "next";

import { SalesHistoryView } from "@/components/pos/salesHistoryView";

export const metadata: Metadata = { title: "Sales history" };

export default function SalesHistoryPage() {
  return <SalesHistoryView />;
}
