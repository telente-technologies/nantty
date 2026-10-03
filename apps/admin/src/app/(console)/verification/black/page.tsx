import type { Metadata } from "next";

import { BlackApplicationsWorkspace } from "@/components/people/blackApplicationsWorkspace";

export const metadata: Metadata = { title: "Black applications" };

export default function BlackApplicationsPage() {
  return <BlackApplicationsWorkspace />;
}
