import type { Metadata } from "next";

import { LegalPolicyPage } from "@/components/legal/legalPolicyPage";
import { findLegalPolicyOrThrow } from "@/content/legalPolicies.content";

export const metadata: Metadata = {
  title: "Terms of service",
  description: "The rules for using Nantty as a buyer or seller.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return <LegalPolicyPage policy={findLegalPolicyOrThrow("terms")} />;
}
