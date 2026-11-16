import type { Metadata } from "next";

import { OrganizationWorkspace } from "@/components/organizationWorkspace";
import { PortalShell } from "@/components/portalShell";

export const metadata: Metadata = { title: "Organization", robots: { index: false, follow: false } };

export default function OrganizationPage() {
  return <PortalShell homeHref="/dashboard"><OrganizationWorkspace /></PortalShell>;
}
