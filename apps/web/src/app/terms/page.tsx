import type { Metadata } from "next";

import { PlaceholderLegalDocument } from "@/components/legal/legalDocument";
import { termsOfServiceSections } from "@/content/termsOfService.content";

export const metadata: Metadata = {
  title: "Terms of service",
  description: "The rules for using Zudomart as a buyer or seller.",
  alternates: { canonical: "/terms" },
};

export default function TermsOfServicePage() {
  return (
    <PlaceholderLegalDocument
      title="Terms of service"
      summary="The rules for buying, selling and posting on Zudomart."
      versionLabel="[version placeholder]"
      effectiveDateLabel="[effective date placeholder]"
      sections={termsOfServiceSections}
    />
  );
}
