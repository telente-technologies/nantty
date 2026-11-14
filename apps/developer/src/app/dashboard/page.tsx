import type { Metadata } from "next";

import { DeveloperOverview } from "@/components/developerOverview";
import { PortalShell } from "@/components/portalShell";

export const metadata: Metadata = { title: "Workspace preview", robots: { index: false, follow: false } };

export default function DeveloperWorkspacePreviewPage() {
  return <PortalShell homeHref="/dashboard"><DeveloperOverview /></PortalShell>;
}
