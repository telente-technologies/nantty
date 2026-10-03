import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { StatementDocumentView } from "@/components/wallet/statementDocumentView";

export const metadata: Metadata = { title: "Statement" };

export default async function StatementDocumentPage({ params }: { readonly params: Promise<{ readonly month: string }> }) {
  const { month } = await params;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) notFound();
  return <StatementDocumentView month={month} />;
}
