import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { BusinessMessagingDocs } from "@/components/businessMessagingDocs";
import { PublicDocsShell } from "@/components/publicDocsShell";
import { readDeveloperDocsUrl } from "@/config/site.config";

const documentRoutes = ["business-messaging", "messaging"] as const;

export function generateStaticParams() {
  return documentRoutes.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { readonly params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  if (!documentRoutes.includes(slug as (typeof documentRoutes)[number])) return {};
  return {
    title: "Business Messaging API",
    description: "Review the proposed Nantty Business Messaging API contract and its security requirements.",
    alternates: { canonical: new URL(`/${slug === "messaging" ? "messaging" : "business-messaging"}`, readDeveloperDocsUrl()).toString() },
    robots: { index: true, follow: true },
  };
}

export default async function PublicDocsAliasPage({ params }: { readonly params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!documentRoutes.includes(slug as (typeof documentRoutes)[number])) notFound();

  return (
    <PublicDocsShell>
      <BusinessMessagingDocs />
    </PublicDocsShell>
  );
}
