import type { Metadata } from "next";

import { LegalPolicyPage } from "@/components/legal/legalPolicyPage";
import { findLegalPolicyOrThrow } from "@/content/legalPolicies.content";

export const metadata: Metadata = {
  title: "Refund and escrow policy",
  description: "How payments are held, released and refunded.",
  alternates: { canonical: "/refund-escrow-policy" },
};

export default function RefundEscrowPolicyPage() {
  return <LegalPolicyPage policy={findLegalPolicyOrThrow("refund-escrow-policy")} />;
}
