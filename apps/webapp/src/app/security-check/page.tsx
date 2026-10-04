import type { Metadata } from "next";

import { SecurityCheckForApp } from "@/components/security/securityCheckForApp";

export const metadata: Metadata = { title: "Security check", robots: { index: false, follow: false } };

export default function SecurityCheckPage() {
  return <SecurityCheckForApp />;
}
