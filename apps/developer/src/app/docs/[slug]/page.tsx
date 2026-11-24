import { notFound } from "next/navigation";

import { BusinessMessagingDocs } from "@/components/businessMessagingDocs";
import { DeveloperGuideArticle } from "@/components/developerPublicPages";
import { PublicDocsShell } from "@/components/publicDocsShell";
import { docGuideSlugs, type DocGuideSlug } from "@/config/docs.config";

export function generateStaticParams() {
  return docGuideSlugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { readonly params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const labels: Record<string, string> = {
    "business-messaging": "Business Messaging API",
    messaging: "Business Messaging API",
    quickstart: "Quickstart",
    "api-reference": "API Reference",
    authentication: "Authentication & SSO",
    webhooks: "Webhooks & Signatures",
    sandbox: "Sandbox Guide",
    errors: "Error Reference",
    "rate-limits": "Rate Limits & Quotas",
    billing: "Billing & Plans",
  };
  return { title: labels[slug] ?? "Developer Docs" };
}

export default async function PublicDocSlugPage({ params }: { readonly params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!docGuideSlugs.includes(slug as DocGuideSlug)) notFound();

  return (
    <PublicDocsShell>
      {slug === "business-messaging" || slug === "messaging" ? (
        <BusinessMessagingDocs />
      ) : (
        <DeveloperGuideArticle slug={slug as Exclude<DocGuideSlug, "business-messaging" | "messaging">} />
      )}
    </PublicDocsShell>
  );
}
