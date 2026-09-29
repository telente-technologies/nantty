import type { Metadata } from "next";

import { RulesPage } from "@/components/tools/rulesPage";

export const metadata: Metadata = { title: "Automated rules" };

export default function Page() {
  return <RulesPage />;
}
