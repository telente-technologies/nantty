import { notFound } from "next/navigation";

import { PortalSectionView } from "@/components/portalSectionView";
import { developerSectionDetails, developerSections, isDeveloperSectionKey } from "@/config/sections.config";
import { PortalShell } from "@/components/portalShell";
import { BusinessMessagingDocs } from "@/components/businessMessagingDocs";
import { OrganizationApplicationsWorkspace } from "@/components/organizationApplicationsWorkspace";
import { DeveloperCredentialsWorkspace } from "@/components/developerCredentialsWorkspace";
import { DeveloperRequestsWorkspace } from "@/components/developerRequestsWorkspace";
import { DeveloperUsageWorkspace } from "@/components/developerUsageWorkspace";
import { DeveloperWebhooksWorkspace } from "@/components/developerWebhooksWorkspace";

export function generateStaticParams() {
  return developerSections.filter(({ href }) => href !== "/docs" && href !== "/organization").map(({ href }) => ({ section: href.slice(1) }));
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

  return (
    <PortalShell homeHref="/dashboard">
      {section === "messaging" ? <BusinessMessagingDocs />
        : section === "applications" ? <OrganizationApplicationsWorkspace />
        : section === "credentials" ? <DeveloperCredentialsWorkspace />
        : section === "webhooks" ? <DeveloperWebhooksWorkspace />
        : section === "requests" ? <DeveloperRequestsWorkspace />
        : section === "usage" ? <DeveloperUsageWorkspace />
        : <PortalSectionView section={details} isDocumentationPage={section === "docs"} />}
    </PortalShell>
  );
}
