import type { Metadata } from "next";
import type { ReactNode } from "react";

import { StudioShell } from "@/components/shell/studioShell";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function StudioLayout({ children }: { readonly children: ReactNode }) {
  return <StudioShell>{children}</StudioShell>;
}
