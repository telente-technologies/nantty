import type { Metadata } from "next";

import { SecurityCasesWorkspace } from "@/components/trust/securityCasesWorkspace";

export const metadata: Metadata = { title: "Security cases" };

export default function SecurityCasesPage() {
  return <SecurityCasesWorkspace />;
}
