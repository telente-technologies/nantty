import type { Metadata } from "next";

import { BusinessDocumentsView } from "@/components/documents/businessDocumentsView";

export const metadata: Metadata = { title: "Business documents" };

export default function BusinessDocumentsPage() {
  return <BusinessDocumentsView />;
}
