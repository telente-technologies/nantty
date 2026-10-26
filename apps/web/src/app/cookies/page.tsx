import type { Metadata } from "next";

import { LegalPolicyPage } from "@/components/legal/legalPolicyPage";
import { findLegalPolicyOrThrow } from "@/content/legalPolicies.content";

export const metadata: Metadata = {
  title: "Cookie policy",
  description: "The cookies Nantty uses, what each category is for and how to control them.",
  alternates: { canonical: "/cookies" },
};

export default function CookiesPage() {
  return <LegalPolicyPage policy={findLegalPolicyOrThrow("cookies")} />;
}
