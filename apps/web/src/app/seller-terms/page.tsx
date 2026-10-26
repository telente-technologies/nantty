import type { Metadata } from "next";

import { LegalPolicyPage } from "@/components/legal/legalPolicyPage";
import { findLegalPolicyOrThrow } from "@/content/legalPolicies.content";

export const metadata: Metadata = {
  title: "Seller terms",
  description: "The extra terms that apply when you sell on Nantty.",
  alternates: { canonical: "/seller-terms" },
};

export default function SellerTermsPage() {
  return <LegalPolicyPage policy={findLegalPolicyOrThrow("seller-terms")} />;
}
