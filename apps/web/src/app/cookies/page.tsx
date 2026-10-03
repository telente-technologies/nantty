import type { Metadata } from "next";

import { PlaceholderLegalDocument } from "@/components/legal/legalDocument";
import { cookiePolicySections } from "@/content/cookiePolicy.content";

export const metadata: Metadata = {
  title: "Cookie policy",
  description: "The cookies Zudomart uses, what each category is for and how to control them.",
  alternates: { canonical: "/cookies" },
};

export default function CookiePolicyPage() {
  return (
    <PlaceholderLegalDocument
      title="Cookie policy"
      summary="Which cookies Zudomart uses, why, and how you stay in control."
      versionLabel="[version placeholder]"
      effectiveDateLabel="[effective date placeholder]"
      sections={cookiePolicySections}
    />
  );
}
