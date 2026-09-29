import type { Metadata } from "next";

import { ProgramApplicationsWorkspace } from "@/components/people/programApplicationsWorkspace";

export const metadata: Metadata = { title: "Creator applications" };

export default function CreatorApplicationsPage() {
  return <ProgramApplicationsWorkspace kind="creators" />;
}
