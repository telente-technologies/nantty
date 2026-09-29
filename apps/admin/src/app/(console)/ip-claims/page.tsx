import type { Metadata } from "next";

import { IpClaimsQueueWorkspace } from "@/components/brands/ipClaimsQueueWorkspace";

export const metadata: Metadata = { title: "Trademark claims" };

export default function IpClaimsPage() {
  return <IpClaimsQueueWorkspace />;
}
