import type { Metadata } from "next";

import { LegalPolicyPage } from "@/components/legal/legalPolicyPage";
import { findLegalPolicyOrThrow } from "@/content/legalPolicies.content";

export const metadata: Metadata = {
  title: "Creator Program terms",
  description: "The terms for earning as a Nantty creator.",
  alternates: { canonical: "/creator-terms" },
};

export default function CreatorTermsPage() {
  return <LegalPolicyPage policy={findLegalPolicyOrThrow("creator-terms")} />;
}
