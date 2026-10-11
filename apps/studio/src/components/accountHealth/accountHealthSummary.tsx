"use client";

import { useQuery } from "@tanstack/react-query";

import { Badge, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Card, DataRows, Muted, pageStyles } from "@/components/ui/studioPage";
import { webappLinks } from "@/config/webappLinks.config";
import { accountHealthService, accountStandingLabel } from "@/services/accountHealth.service";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import type { AccountHealthSummary } from "@/types/accountHealth.type";

const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const standingTone = { GOOD_STANDING: "success", AT_RISK: "warning", RESTRICTED: "error" } as const;

function ladderRows(health: AccountHealthSummary) {
  const copyright = health.copyrightStrikesInWindow ?? health.activeStrikeCount;
  const window = health.strikeWindowDays ? ` in ${health.strikeWindowDays} days` : "";
  return [
    { key: "now", label: "Copyright strikes now", detail: `Each strike expires ${health.strikeLifetimeDays} days after it's issued`, value: `${copyright}${window}` },
    { key: "restrict", label: `At ${health.restrictionThreshold} strikes`, detail: "Earning and going live are paused", value: copyright >= health.restrictionThreshold ? "Reached" : `${health.restrictionThreshold - copyright} to go` },
    ...(health.suspensionReviewThreshold ? [{ key: "suspend", label: `At ${health.suspensionReviewThreshold} strikes`, detail: "Your account is reviewed for suspension", value: copyright >= health.suspensionReviewThreshold ? "Reached" : `${health.suspensionReviewThreshold - copyright} to go` }] : []),
  ];
}

export function AccountStandingCard() {
  const health = useQuery({ queryKey: ["account", "status"], queryFn: accountHealthService.fetchMine, staleTime: 60_000 });
  if (health.isError) return <ErrorState title="Account standing didn't load" description={readErrorMessageForDisplay(health.error)} onRetry={() => void health.refetch()} />;
  if (!health.data) return <Skeleton height={200} />;
  const data = health.data;
  const strikes = [...(data.strikes ?? []).map((strike) => ({ ...strike, label: "Strike" })), ...data.warnings.map((warning) => ({ ...warning, label: "Warning" }))];
  return (
    <Card title="Account standing" action={<Badge tone={standingTone[data.status]}>{accountStandingLabel(data.status)}</Badge>}>
      <DataRows rows={ladderRows(data)} />
      {!data.canMonetise || !data.canGoLive ? <p className={pageStyles.error}>{`Paused now: ${[!data.canMonetise ? "earning" : null, !data.canGoLive ? "going live" : null].filter(Boolean).join(" and ")}.`}</p> : null}
      {data.notices.length > 0 ? (
        <DataRows rows={data.notices.map((notice) => ({ key: notice.claimId, label: `Takedown notice${notice.workTitle ? `: ${notice.workTitle}` : ""}`, detail: notice.deadlineAt ? `Act by ${shortDate(notice.deadlineAt)}: remove it or send a counter-notice` : notice.state, value: notice.canCounterNotice === false ? "Decided" : "Open" }))} />
      ) : null}
      {strikes.length > 0 ? (
        <DataRows rows={strikes.map((strike) => ({ key: strike.id, label: strike.reason || strike.policy, detail: `${strike.label} · issued ${shortDate(strike.issuedAt)}${strike.expiresAt ? ` · expires ${shortDate(strike.expiresAt)}` : ""}${strike.appealStatus !== "none" ? ` · appeal ${strike.appealStatus}` : ""}`, value: strike.canAppeal ? "Can appeal" : strike.status }))} />
      ) : (
        <Muted>No strikes or warnings. Keep using licensed music and your own footage to stay that way.</Muted>
      )}
      {strikes.some((strike) => strike.canAppeal) || data.notices.length > 0 ? (
        <a href={webappLinks.accountStatus} target="_blank" rel="noopener noreferrer" className={pageStyles.textLink}>Appeal a strike or send a counter-notice</a>
      ) : null}
    </Card>
  );
}
