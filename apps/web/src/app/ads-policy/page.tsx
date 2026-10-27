import { LegalPolicyPage } from "@/components/legal/legalPolicyPage";
import { findLegalPolicyOrThrow } from "@/content/legalPolicies.content";
import { createPublicPageMetadata } from "@/lib/pageMetadata.util";

export const metadata = createPublicPageMetadata({ title: "Ads policy", description: "What can and cannot be advertised on Nantty.", path: "/ads-policy" });

export default function AdsPolicyPage() {
  return <LegalPolicyPage policy={findLegalPolicyOrThrow("ads-policy")} />;
}
