import type { Metadata } from "next";

import { PlaceholderLegalDocument } from "@/components/legal/legalDocument";
import { privacyPolicySections } from "@/content/privacyPolicy.content";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "How Zudomart collects, uses and protects your personal data.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPolicyPage() {
  return (
    <PlaceholderLegalDocument
      title="Privacy policy"
      summary="What personal data Zudomart collects, why, who we share it with, and the choices you have."
      versionLabel="[version placeholder]"
      effectiveDateLabel="[effective date placeholder]"
      sections={privacyPolicySections}
    />
  );
}
