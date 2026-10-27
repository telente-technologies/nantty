import { LegalPolicyPage } from "@/components/legal/legalPolicyPage";
import { findLegalPolicyOrThrow } from "@/content/legalPolicies.content";
import { createPublicPageMetadata } from "@/lib/pageMetadata.util";

export const metadata = createPublicPageMetadata({ title: "Refund and escrow policy", description: "How payments are held, released and refunded.", path: "/refund-escrow-policy" });

export default function RefundEscrowPolicyPage() {
  return <LegalPolicyPage policy={findLegalPolicyOrThrow("refund-escrow-policy")} />;
}
