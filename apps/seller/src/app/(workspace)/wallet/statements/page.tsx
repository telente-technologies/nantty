import type { Metadata } from "next";

import { StatementsView } from "@/components/wallet/statementsView";

export const metadata: Metadata = { title: "Statements" };

export default function StatementsPage() {
  return <StatementsView />;
}
