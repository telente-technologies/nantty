import { LegalPolicyPage } from "@/components/legal/legalPolicyPage";
import { findLegalPolicyOrThrow } from "@/content/legalPolicies.content";
import { createPublicPageMetadata } from "@/lib/pageMetadata.util";

export const metadata = createPublicPageMetadata({ title: "Seller terms", description: "The extra terms that apply when you sell on Nantty.", path: "/seller-terms" });

export default function SellerTermsPage() {
  return <LegalPolicyPage policy={findLegalPolicyOrThrow("seller-terms")} />;
}
