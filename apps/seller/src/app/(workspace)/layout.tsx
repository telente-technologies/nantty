import type { ReactNode } from "react";

import { WorkspaceShell } from "@/components/layout/workspaceShell";
import { readAdsManagerUrl } from "@/config/siteMetadata.config";

export default function WorkspaceLayout({ children }: { readonly children: ReactNode }) {
  return <WorkspaceShell adsManagerUrl={readAdsManagerUrl()}>{children}</WorkspaceShell>;
}
