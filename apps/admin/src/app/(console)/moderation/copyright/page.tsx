import type { Metadata } from "next";

import { CopyrightClaimsWorkspace } from "@/components/trust/copyrightClaimsWorkspace";

export const metadata: Metadata = { title: "Copyright claims" };

export default function CopyrightClaimsPage() {
  return <CopyrightClaimsWorkspace />;
}
