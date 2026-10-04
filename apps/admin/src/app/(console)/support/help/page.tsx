import type { Metadata } from "next";

import { HelpContentWorkspace } from "@/components/help/helpContentWorkspace";

export const metadata: Metadata = { title: "Help centre" };

export default function HelpCentrePage() {
  return <HelpContentWorkspace />;
}
