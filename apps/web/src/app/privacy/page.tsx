import type { Metadata } from "next";

import { LegalPolicyPage } from "@/components/legal/legalPolicyPage";
import { findLegalPolicyOrThrow } from "@/content/legalPolicies.content";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "How Nantty collects, uses and protects your personal data.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return <LegalPolicyPage policy={findLegalPolicyOrThrow("privacy")} />;
}
