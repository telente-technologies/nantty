import type { ReactNode } from "react";

import { WorkspaceShell } from "@/components/layout/workspaceShell";

export default function WorkspaceLayout({ children }: { readonly children: ReactNode }) {
  return <WorkspaceShell>{children}</WorkspaceShell>;
}
