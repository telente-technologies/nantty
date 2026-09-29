import type { Metadata } from "next";

import { DisputesListView } from "@/components/orders/disputesListView";

export const metadata: Metadata = { title: "Disputes" };

export default function DisputesPage() {
  return <DisputesListView />;
}
