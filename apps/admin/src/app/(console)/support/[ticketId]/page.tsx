import type { Metadata } from "next";

import { TicketDetailWorkspace } from "@/components/support/ticketDetailWorkspace";

export const metadata: Metadata = { title: "Ticket" };

export default async function SupportTicketPage({ params }: { readonly params: Promise<{ readonly ticketId: string }> }) {
  const { ticketId } = await params;
  return <TicketDetailWorkspace ticketId={ticketId} />;
}
