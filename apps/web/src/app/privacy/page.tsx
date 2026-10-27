import { LegalPolicyPage } from "@/components/legal/legalPolicyPage";
import { findLegalPolicyOrThrow } from "@/content/legalPolicies.content";
import { createPublicPageMetadata } from "@/lib/pageMetadata.util";

export const metadata = createPublicPageMetadata({ title: "Privacy policy", description: "How Nantty collects, uses and protects your personal data.", path: "/privacy" });

export default function PrivacyPage() {
  return <LegalPolicyPage policy={findLegalPolicyOrThrow("privacy")} />;
}
