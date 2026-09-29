import type { Metadata } from "next";

import { StaffInviteForm } from "@/components/staff/staffInviteForm";

export const metadata: Metadata = { title: "Invite staff" };

export default function InviteStaffPage() {
  return <StaffInviteForm />;
}
