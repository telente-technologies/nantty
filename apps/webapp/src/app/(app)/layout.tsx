import type { ReactNode } from "react";

import { AppShell } from "@/components/shell/appShell";

export default function AppLayout({ children }: { readonly children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
