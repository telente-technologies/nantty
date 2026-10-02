import type { ReactNode } from "react";

import { StudioShell } from "@/components/shell/studioShell";

export default function StudioLayout({ children }: { readonly children: ReactNode }) {
  return <StudioShell>{children}</StudioShell>;
}
