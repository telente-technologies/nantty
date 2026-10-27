import { LegalPolicyPage } from "@/components/legal/legalPolicyPage";
import { findLegalPolicyOrThrow } from "@/content/legalPolicies.content";
import { createPublicPageMetadata } from "@/lib/pageMetadata.util";

export const metadata = createPublicPageMetadata({ title: "Community guidelines", description: "How we expect everyone to behave on Nantty.", path: "/community-guidelines" });

export default function CommunityGuidelinesPage() {
  return <LegalPolicyPage policy={findLegalPolicyOrThrow("community-guidelines")} />;
}
