import type { Metadata } from "next";

import { AudiencesPage } from "@/components/audiences/audiencesPage";

export const metadata: Metadata = { title: "Audiences" };

export default function Page() {
  return <AudiencesPage />;
}
