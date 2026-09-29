import type { Metadata } from "next";

import { AffiliateLiveInvitationsView } from "@/components/affiliates/affiliateLiveInvitationsView";

export const metadata: Metadata = { title: "Live selling" };

export default function AffiliateLiveInvitationsPage() {
  return <AffiliateLiveInvitationsView />;
}
