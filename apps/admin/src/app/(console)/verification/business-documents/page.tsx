import type { Metadata } from "next";

import { BusinessDocumentsWorkspace } from "@/components/people/businessDocumentsWorkspace";

export const metadata: Metadata = { title: "Business documents" };

export default function BusinessDocumentsPage() {
  return <BusinessDocumentsWorkspace />;
}
