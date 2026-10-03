import type { Metadata } from "next";

import { SuspensionsWorkspace } from "@/components/trust/suspensionsWorkspace";

export const metadata: Metadata = { title: "Suspensions" };

export default function SuspensionsPage() {
  return <SuspensionsWorkspace />;
}
