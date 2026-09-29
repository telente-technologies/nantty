import type { Metadata } from "next";

import { PlatformRulesWorkspace } from "@/components/configuration/rules/platformRulesWorkspace";

export const metadata: Metadata = { title: "Platform rules" };

export default function PlatformRulesPage() {
  return <PlatformRulesWorkspace />;
}
