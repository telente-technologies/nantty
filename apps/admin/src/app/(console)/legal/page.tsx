import type { Metadata } from "next";

import { LegalDocumentsWorkspace } from "@/components/legal/legalDocumentsWorkspace";

export const metadata: Metadata = { title: "Legal documents" };

export default function LegalDocumentsPage() {
  return <LegalDocumentsWorkspace />;
}
