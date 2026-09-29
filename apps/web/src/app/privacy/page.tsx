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
      summary="What personal data Zudomart collects, why, and the choices you have."
      lastUpdatedLabel="Draft, not yet in effect"
      sections={privacyPolicySections}
    />
  );
}
