import type { Metadata } from "next";

import { LegalPolicyPage } from "@/components/legal/legalPolicyPage";
import { findLegalPolicyOrThrow } from "@/content/legalPolicies.content";

export const metadata: Metadata = {
  title: "Community guidelines",
  description: "How we expect everyone to behave on Nantty.",
  alternates: { canonical: "/community-guidelines" },
};

export default function CommunityGuidelinesPage() {
  return <LegalPolicyPage policy={findLegalPolicyOrThrow("community-guidelines")} />;
}
