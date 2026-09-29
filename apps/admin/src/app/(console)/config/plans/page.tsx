import type { Metadata } from "next";

import { PlansWorkspace } from "@/components/configuration/plans/plansWorkspace";

export const metadata: Metadata = { title: "Plans & prices" };

export default function PlansPage() {
  return <PlansWorkspace />;
}
