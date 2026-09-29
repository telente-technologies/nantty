import type { Metadata } from "next";

import { ProgramApplicationsWorkspace } from "@/components/people/programApplicationsWorkspace";

export const metadata: Metadata = { title: "Seller applications" };

export default function SellerApplicationsPage() {
  return <ProgramApplicationsWorkspace kind="sellers" />;
}
