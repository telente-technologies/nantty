import { LegalPolicyPage } from "@/components/legal/legalPolicyPage";
import { findLegalPolicyOrThrow } from "@/content/legalPolicies.content";
import { createPublicPageMetadata } from "@/lib/pageMetadata.util";

export const metadata = createPublicPageMetadata({ title: "Terms of service", description: "The rules for using Nantty as a buyer or seller.", path: "/terms" });

export default function TermsPage() {
  return <LegalPolicyPage policy={findLegalPolicyOrThrow("terms")} />;
}
