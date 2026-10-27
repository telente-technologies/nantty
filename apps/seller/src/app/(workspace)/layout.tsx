import type { Metadata } from "next";
import type { ReactNode } from "react";

import { WorkspaceShell } from "@/components/layout/workspaceShell";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function WorkspaceLayout({ children }: { readonly children: ReactNode }) {
  return <WorkspaceShell>{children}</WorkspaceShell>;
}
