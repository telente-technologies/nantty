import type { Metadata } from "next";

import { ReservedUsernamesWorkspace } from "@/components/people/reservedUsernamesWorkspace";

export const metadata: Metadata = { title: "Reserved usernames" };

export default function ReservedUsernamesPage() {
  return <ReservedUsernamesWorkspace />;
}
