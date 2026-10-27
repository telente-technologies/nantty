import { LegalPolicyPage } from "@/components/legal/legalPolicyPage";
import { findLegalPolicyOrThrow } from "@/content/legalPolicies.content";
import { createPublicPageMetadata } from "@/lib/pageMetadata.util";

export const metadata = createPublicPageMetadata({ title: "Copyright and IP policy", description: "How to report copyright and trademark infringement or counterfeits on Nantty, and how we handle repeat infringers.", path: "/copyright-policy" });

export default function CopyrightPolicyPage() {
  return <LegalPolicyPage policy={findLegalPolicyOrThrow("copyright-policy")} />;
}
