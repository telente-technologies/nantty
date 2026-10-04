import type { Metadata } from "next";

import { ManipulationFlagsWorkspace } from "@/components/ranking/manipulationFlagsWorkspace";

export const metadata: Metadata = { title: "Manipulation flags" };

export default function ManipulationFlagsPage() {
  return <ManipulationFlagsWorkspace />;
}
