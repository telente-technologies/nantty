import type { Metadata } from "next";

import { LegalDocumentWorkspace } from "@/components/legal/legalDocumentWorkspace";

export const metadata: Metadata = { title: "Legal document" };

export default async function LegalDocumentPage({ params }: { params: Promise<{ documentKey: string }> }) {
  const { documentKey } = await params;
  return <LegalDocumentWorkspace documentKey={documentKey} />;
}
