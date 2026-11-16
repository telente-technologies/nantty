import { notFound } from "next/navigation";

import { PortalSectionView } from "@/components/portalSectionView";
import { PortalShell } from "@/components/portalShell";
import { SandboxEventsWorkspace } from "@/components/sandboxEventsWorkspace";
import { SandboxExplorerWorkspace } from "@/components/sandboxExplorerWorkspace";
import { SandboxMessagingWorkspace } from "@/components/sandboxMessagingWorkspace";
import { SandboxRequestsWorkspace } from "@/components/sandboxRequestsWorkspace";
import { SandboxScenariosWorkspace } from "@/components/sandboxScenariosWorkspace";
import { SandboxTestAppsWorkspace } from "@/components/sandboxTestAppsWorkspace";
import { isSandboxSectionKey, sandboxSectionDetails, sandboxSections } from "@/config/sections.config";

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

  return (
    <PortalShell>
      {section === "test-apps" ? <SandboxTestAppsWorkspace />
        : section === "explorer" ? <SandboxExplorerWorkspace />
        : section === "messaging" ? <SandboxMessagingWorkspace />
        : section === "scenarios" ? <SandboxScenariosWorkspace />
        : section === "events" ? <SandboxEventsWorkspace />
        : section === "requests" ? <SandboxRequestsWorkspace />
        : <PortalSectionView section={details} isDocumentationPage />}
    </PortalShell>
  );
}
