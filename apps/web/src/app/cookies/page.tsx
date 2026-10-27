import { LegalPolicyPage } from "@/components/legal/legalPolicyPage";
import { findLegalPolicyOrThrow } from "@/content/legalPolicies.content";
import { createPublicPageMetadata } from "@/lib/pageMetadata.util";

export const metadata = createPublicPageMetadata({ title: "Cookie policy", description: "The cookies Nantty uses, what each category is for and how to control them.", path: "/cookies" });

export default function CookiesPage() {
  return <LegalPolicyPage policy={findLegalPolicyOrThrow("cookies")} />;
}
