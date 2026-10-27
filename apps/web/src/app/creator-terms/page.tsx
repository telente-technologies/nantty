import { LegalPolicyPage } from "@/components/legal/legalPolicyPage";
import { findLegalPolicyOrThrow } from "@/content/legalPolicies.content";
import { createPublicPageMetadata } from "@/lib/pageMetadata.util";

export const metadata = createPublicPageMetadata({ title: "Creator Program terms", description: "The terms for earning as a Nantty creator.", path: "/creator-terms" });

export default function CreatorTermsPage() {
  return <LegalPolicyPage policy={findLegalPolicyOrThrow("creator-terms")} />;
}
