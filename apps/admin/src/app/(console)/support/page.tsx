import type { Metadata } from "next";
import { Suspense } from "react";

import { TicketsWorkspace } from "@/components/support/ticketsWorkspace";

export const metadata: Metadata = { title: "Support tickets" };

export default function SupportTicketsPage() {
  return (
    <Suspense>
      <TicketsWorkspace />
    </Suspense>
  );
}
