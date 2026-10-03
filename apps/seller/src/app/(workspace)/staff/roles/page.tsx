import type { Metadata } from "next";

import { StaffRolesMatrixView } from "@/components/staff/staffRolesMatrixView";

export const metadata: Metadata = { title: "Roles & permissions" };

export default function StaffRolesPage() {
  return <StaffRolesMatrixView />;
}
