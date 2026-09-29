import type { Metadata } from "next";

import { AdminsWorkspace } from "@/components/admins/adminsWorkspace";

export const metadata: Metadata = { title: "Admins & roles" };

export default function AdminsPage() {
  return <AdminsWorkspace />;
}
