import type { Metadata } from "next";

import { LegalPolicyPage } from "@/components/legal/legalPolicyPage";
import { findLegalPolicyOrThrow } from "@/content/legalPolicies.content";

export const metadata: Metadata = {
  title: "Ads policy",
  description: "What can and cannot be advertised on Nantty.",
  alternates: { canonical: "/ads-policy" },
};

export default function AdsPolicyPage() {
  return <LegalPolicyPage policy={findLegalPolicyOrThrow("ads-policy")} />;
}
