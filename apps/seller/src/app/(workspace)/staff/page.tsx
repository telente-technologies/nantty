import type { Metadata } from "next";

import { StaffTeamView } from "@/components/staff/staffTeamView";

export const metadata: Metadata = { title: "Team" };

export default function StaffPage() {
  return <StaffTeamView />;
}
