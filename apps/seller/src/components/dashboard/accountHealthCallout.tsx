"use client";

import { Callout } from "@/components/ui/feedback";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import type { SellerAccountHealth } from "@/types/accountHealth.type";

const webappUrl = process.env.NEXT_PUBLIC_WEBAPP_URL ?? "https://web.nantty.com";
const labels = { GOOD_STANDING: "Good standing", AT_RISK: "At risk", RESTRICTED: "Restricted" } as const;
const tones = { GOOD_STANDING: "success", AT_RISK: "caution", RESTRICTED: "error" } as const;

export function AccountHealthCallout() {
  const { data: health } = useSellerQuery<SellerAccountHealth>("/account/status");
  if (!health) return null;
  const detail = health.status === "GOOD_STANDING"
    ? "No active strikes. Copyright and policy notices about your posts, clips and lives show up here."
    : `${health.activeStrikeCount} of ${health.restrictionThreshold} active strikes${health.pendingTakedownCount > 0 ? `, ${health.pendingTakedownCount} copyright takedown deadline pending` : ""}.${health.canMonetise ? "" : " Monetisation and going live are paused."}`;
  return (
    <Callout tone={tones[health.status]} title={`Account status: ${labels[health.status]}`} action={<a href={`${webappUrl}/settings/account-status`} target="_blank" rel="noopener noreferrer">View details</a>}>
      {detail}
    </Callout>
  );
}
