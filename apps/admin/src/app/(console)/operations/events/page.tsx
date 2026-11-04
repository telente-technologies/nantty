import type { Metadata } from "next";

import { EventOperationsWorkspace } from "@/components/operations/eventOperationsWorkspace";

export const metadata: Metadata = { title: "Event operations" };

export default function EventOperationsPage() {
  return <EventOperationsWorkspace />;
}
