import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { BusinessMessagingDocs } from "@/components/businessMessagingDocs";
import { DeveloperGuidePageView, docGuideSlugs, type DocGuideSlug } from "@/components/developerPublicPages";
import { PublicDocsShell } from "@/components/publicDocsShell";
import { readDeveloperDocsUrl } from "@/config/site.config";

export function generateStaticParams() {
  return docGuideSlugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { readonly params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  if (!docGuideSlugs.includes(slug as DocGuideSlug)) return {};
  return {
    title: slug === "business-messaging" || slug === "messaging" ? "Business Messaging API" : `Documentation · ${slug}`,
    alternates: { canonical: new URL(`/${slug}`, readDeveloperDocsUrl()).toString() },
    robots: { index: true, follow: true },
  };
}

export default async function PublicDocsSlugPage({ params }: { readonly params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!docGuideSlugs.includes(slug as DocGuideSlug)) notFound();

  return (
    <PublicDocsShell>
      {slug === "business-messaging" || slug === "messaging" ? (
        <BusinessMessagingDocs />
      ) : (
        <DeveloperGuidePageView slug={slug as Exclude<DocGuideSlug, "business-messaging" | "messaging">} />
      )}
    </PublicDocsShell>
  );
}
