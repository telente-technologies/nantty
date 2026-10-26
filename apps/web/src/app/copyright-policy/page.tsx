import type { Metadata } from "next";

import { LegalPolicyPage } from "@/components/legal/legalPolicyPage";
import { findLegalPolicyOrThrow } from "@/content/legalPolicies.content";

export const metadata: Metadata = {
  title: "Copyright and IP policy",
  description: "How to report copyright and trademark infringement or counterfeits on Nantty, and how we handle repeat infringers.",
  alternates: { canonical: "/copyright-policy" },
};

export default function CopyrightPolicyPage() {
  return <LegalPolicyPage policy={findLegalPolicyOrThrow("copyright-policy")} />;
}
