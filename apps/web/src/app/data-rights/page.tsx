import type { Metadata } from "next";

import { LegalPolicyPage } from "@/components/legal/legalPolicyPage";
import { findLegalPolicyOrThrow } from "@/content/legalPolicies.content";

export const metadata: Metadata = {
  title: "Data rights requests",
  description: "How to access, correct, delete or download your Zudomart data, and how long we take to answer.",
  alternates: { canonical: "/data-rights" },
};

export default function DataRightsPage() {
  return <LegalPolicyPage policy={findLegalPolicyOrThrow("data-rights")} />;
}
