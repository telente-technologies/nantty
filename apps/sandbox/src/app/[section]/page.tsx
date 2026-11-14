import { notFound } from "next/navigation";

import { PortalSectionView } from "@/components/portalSectionView";
import { isSandboxSectionKey, sandboxSectionDetails, sandboxSections } from "@/config/sections.config";
import { PortalShell } from "@/components/portalShell";

export function generateStaticParams() {
  return sandboxSections.map(({ href }) => ({ section: href.slice(1) }));
}

export async function generateMetadata({ params }: { readonly params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!isSandboxSectionKey(section)) return {};
  return { title: sandboxSectionDetails[section].title };
}

export default async function SandboxSectionPage({ params }: { readonly params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!isSandboxSectionKey(section)) notFound();
  const details = sandboxSectionDetails[section];
  return <PortalShell><PortalSectionView section={details} isDocumentationPage={section === "docs" || section === "messaging"} /></PortalShell>;
}
