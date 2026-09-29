import type { Metadata } from "next";

import { StaffActivityView } from "@/components/staff/staffActivityView";

export const metadata: Metadata = { title: "Staff activity" };

export default function StaffActivityPage() {
  return <StaffActivityView />;
}
