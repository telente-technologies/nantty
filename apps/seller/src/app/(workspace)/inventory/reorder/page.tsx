import type { Metadata } from "next";

import { ReorderPlanningView } from "@/components/inventory/reorderPlanningView";

export const metadata: Metadata = { title: "Reorder planning" };

export default function ReorderPlanningPage() {
  return <ReorderPlanningView />;
}
