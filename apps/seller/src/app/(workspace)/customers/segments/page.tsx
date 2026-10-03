import type { Metadata } from "next";

import { CustomerSegmentsView } from "@/components/customers/customerSegmentsView";

export const metadata: Metadata = { title: "Customer segments" };

export default function CustomerSegmentsPage() {
  return <CustomerSegmentsView />;
}
