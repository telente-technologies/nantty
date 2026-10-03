import type { Metadata } from "next";

import { StaffInviteForm } from "@/components/staff/staffInviteForm";

export const metadata: Metadata = { title: "Add team member" };

export default function InviteStaffPage() {
  return <StaffInviteForm />;
}
