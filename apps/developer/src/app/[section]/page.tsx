import { notFound } from "next/navigation";

import { PortalSectionView } from "@/components/portalSectionView";
import { developerSectionDetails, developerSections, isDeveloperSectionKey } from "@/config/sections.config";
import { PortalShell } from "@/components/portalShell";
import { BusinessMessagingDocs } from "@/components/businessMessagingDocs";

export function generateStaticParams() {
  return developerSections.filter(({ href }) => href !== "/docs").map(({ href }) => ({ section: href.slice(1) }));
}

export async function generateMetadata({ params }: { readonly params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!isDeveloperSectionKey(section)) return {};
  const details = developerSectionDetails[section];
  return { title: details.title };
}

export default async function DeveloperSectionPage({ params }: { readonly params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!isDeveloperSectionKey(section)) notFound();
  const details = developerSectionDetails[section];

  return <PortalShell homeHref="/dashboard">{section === "messaging" ? <BusinessMessagingDocs /> : <PortalSectionView section={details} isDocumentationPage={section === "docs"} />}</PortalShell>;
}
