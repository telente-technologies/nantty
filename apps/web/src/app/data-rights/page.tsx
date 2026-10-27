import { LegalPolicyPage } from "@/components/legal/legalPolicyPage";
import { findLegalPolicyOrThrow } from "@/content/legalPolicies.content";
import { createPublicPageMetadata } from "@/lib/pageMetadata.util";

export const metadata = createPublicPageMetadata({ title: "Data rights requests", description: "How to access, correct, delete or download your Nantty data, and how long we take to answer.", path: "/data-rights" });

export default function DataRightsPage() {
  return <LegalPolicyPage policy={findLegalPolicyOrThrow("data-rights")} />;
}
