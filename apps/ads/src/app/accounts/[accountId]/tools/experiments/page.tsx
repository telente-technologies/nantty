import type { Metadata } from "next";

import { ExperimentsPage } from "@/components/tools/experimentsPage";

export const metadata: Metadata = { title: "A/B tests" };

export default function Page() {
  return <ExperimentsPage />;
}
