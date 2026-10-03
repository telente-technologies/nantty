import type { Metadata } from "next";

import { LegalNoticesWorkspace } from "@/components/legal/legalNoticesWorkspace";

export const metadata: Metadata = { title: "Policy notices" };

export default function LegalNoticesPage() {
  return <LegalNoticesWorkspace />;
}
