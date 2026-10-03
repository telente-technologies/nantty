import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LegalPolicyPage } from "@/components/legal/legalPolicyPage";
import { legalPolicies } from "@/content/legalPolicies.content";

interface ArchivedVersionPageProps {
  readonly params: Promise<{ readonly slug: string; readonly version: string }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return legalPolicies.flatMap((policy) => policy.previousVersions.map((previous) => ({ slug: policy.slug, version: encodeURIComponent(previous.versionLabel) })));
}

export const metadata: Metadata = { title: "Earlier version", robots: { index: false, follow: true } };

export default async function ArchivedLegalVersionPage({ params }: ArchivedVersionPageProps) {
  const { slug, version } = await params;
  const policy = legalPolicies.find((candidate) => candidate.slug === slug);
  const shownVersion = policy?.previousVersions.find((previous) => previous.versionLabel === decodeURIComponent(version));
  if (!policy || !shownVersion) notFound();
  return <LegalPolicyPage policy={policy} shownVersion={shownVersion} />;
}
