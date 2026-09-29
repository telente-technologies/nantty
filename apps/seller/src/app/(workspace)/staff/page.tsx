import type { Metadata } from "next";

import { StaffTeamView } from "@/components/staff/staffTeamView";

export const metadata: Metadata = { title: "Staff" };

export default function StaffPage() {
  return <StaffTeamView />;
}
