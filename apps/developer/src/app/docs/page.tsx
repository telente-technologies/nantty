import type { Metadata } from "next";

import { PublicDocsShell } from "@/components/publicDocsShell";
import { BusinessMessagingDocs } from "@/components/businessMessagingDocs";
import { readDeveloperDocsUrl } from "@/config/site.config";

export const metadata: Metadata = {
  title: "Nantty API documentation",
  description: "Nantty API documentation, including a proposed Business Messaging API contract. The API is not live and requests are disabled.",
  alternates: { canonical: readDeveloperDocsUrl() },
  robots: { index: true, follow: true },
};

export default function PublicDocsPage() {
  return (
    <PublicDocsShell>
      <BusinessMessagingDocs />
    </PublicDocsShell>
  );
}
