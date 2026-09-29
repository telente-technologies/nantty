import type { Metadata } from "next";

import { DisputesWorkspace } from "@/components/money/disputesWorkspace";

export const metadata: Metadata = { title: "Disputes" };

export default function DisputesPage() {
  return <DisputesWorkspace />;
}
