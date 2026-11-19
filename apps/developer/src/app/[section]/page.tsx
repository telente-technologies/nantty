import { notFound } from "next/navigation";

import { BusinessMessagingDocs } from "@/components/businessMessagingDocs";
import { DeveloperBillingWorkspace } from "@/components/developerBillingWorkspace";
import { DeveloperAuditWorkspace, DeveloperBusinessesWorkspace, DeveloperProductsWorkspace, DeveloperSandboxBridge } from "@/components/developerCatalogAndOps";
import { DeveloperCredentialsWorkspace } from "@/components/developerCredentialsWorkspace";
import { DeveloperOnboardingWorkspace } from "@/components/developerOnboardingWorkspace";
import { DeveloperRequestsWorkspace } from "@/components/developerRequestsWorkspace";
import { DeveloperUsageWorkspace } from "@/components/developerUsageWorkspace";
import { DeveloperWebhooksWorkspace } from "@/components/developerWebhooksWorkspace";
import { OrganizationApplicationsWorkspace } from "@/components/organizationApplicationsWorkspace";
import { PortalSectionView } from "@/components/portalSectionView";
import { PortalShell } from "@/components/portalShell";
import { developerSectionDetails, developerSections, isDeveloperSectionKey } from "@/config/sections.config";

export function generateStaticParams() {
  return developerSections.filter(({ href }) => !["/docs", "/organization", "/products"].includes(href)).map(({ href }) => ({ section: href.slice(1) }));
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
        : section === "billing" ? <DeveloperBillingWorkspace />
        : section === "onboarding" ? <DeveloperOnboardingWorkspace />
        : section === "products" ? <DeveloperProductsWorkspace />
        : section === "businesses" ? <DeveloperBusinessesWorkspace />
        : section === "audit-logs" ? <DeveloperAuditWorkspace />
        : section === "sandbox" ? <DeveloperSandboxBridge />
        : <PortalSectionView section={details} isDocumentationPage={section === "docs"} />}
    </PortalShell>
  );
}
