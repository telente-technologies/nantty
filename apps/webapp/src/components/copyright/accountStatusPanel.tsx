"use client";

import Link from "next/link";
import { useState } from "react";

import { Badge, ErrorState } from "@/components/ui/feedback";
import { DetailSkeleton } from "@/components/ui/pageSkeletons";
import { Button } from "@/components/ui/button";
import rowStyles from "@/components/settings/myReportsList.module.css";
import settingsStyles from "@/components/settings/settings.module.css";
import { COPYRIGHT_HELP_PATH, describeAccountStanding, describeRestriction, formatTimeRemaining } from "@/services/copyrightAccount.service";
import type { AccountHealth, AccountStrike, CopyrightNotice, ModerationDecision } from "@/types";

import { useMyAccountHealth, useMyModerationDecisions } from "./accountHealth.hook";
import { AppealDecisionDialog, AppealStrikeDialog, CounterNoticeDialog } from "./accountStatusDialogs";

const standingTone = { GOOD_STANDING: "success", AT_RISK: "warning", RESTRICTED: "error" } as const;
const formatDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "Never");
const contentLabel = (content: { readonly type: string; readonly id: string }) => `${{ clip: "Clip", post: "Post", sound: "Sound", live: "Live video" }[content.type] ?? "Content"} ${content.id.slice(0, 8)}`;
const remedyLabel: Record<CopyrightNotice["state"], string> = {
  MUTED: "Audio muted, video still up", AWAITING_REMOVAL: "Waiting for you to remove it", REMOVED_VOLUNTARILY: "You removed it in time: no strike",
  TAKEN_DOWN: "Taken down", RESTORED: "Restored after your counter-notice", NONE: "Under review",
};

export function AccountStatusPanel() {
  const { data: health, isPending, isError, error, refetch } = useMyAccountHealth();
  const decisionsQuery = useMyModerationDecisions();
  const [appealTarget, setAppealTarget] = useState<AccountStrike | null>(null);
  const [decisionTarget, setDecisionTarget] = useState<ModerationDecision | null>(null);
  const [counterTarget, setCounterTarget] = useState<CopyrightNotice | null>(null);
  if (isPending) return <DetailSkeleton label="Loading your account status" blocks={3} />;
  if (isError || !health) return <ErrorState error={error} description="We couldn't load your account status." onRetry={() => void refetch()} />;
  const decisions = decisionsQuery.data?.data ?? [];
  return (
    <>
      <StandingSummary health={health} />
      <section className={settingsStyles.block}>
        <h2 className={settingsStyles.blockHeading}>Copyright notices</h2>
        {health.notices.length === 0 ? <p className={rowStyles.meta}>No copyright claims against your content.</p> : (
          <ul className={rowStyles.list}>
            {health.notices.map((notice) => (
              <li key={notice.claimId} className={rowStyles.row}>
                <div className={rowStyles.top}><strong>{contentLabel(notice.content)}</strong><span className={rowStyles.status}>{remedyLabel[notice.state]}</span></div>
                <span className={rowStyles.meta}>Claimed by {notice.claimantName} for {notice.workTitle}</span>
                {notice.state === "AWAITING_REMOVAL" && notice.deadlineAt ? <span className={rowStyles.status}>{formatTimeRemaining(notice.deadlineAt)} · deadline {new Date(notice.deadlineAt).toLocaleString()}</span> : null}
                {notice.counterNoticeStatus ? <span className={rowStyles.meta}>Counter-notice: {notice.counterNoticeStatus.toLowerCase()}</span> : null}
                {notice.canCounterNotice ? <div><Button variant="secondary" onClick={() => setCounterTarget(notice)}>Send a counter-notice</Button></div> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
      <StrikeList title="Active strikes" empty="You have no active strikes." items={health.strikes} onAppeal={setAppealTarget} />
      <StrikeList title="Warnings on record" empty="No warnings." items={health.warnings} onAppeal={setAppealTarget} />
      <ModerationDecisionList items={decisions} onAppeal={setDecisionTarget} />
      <p><Link href={COPYRIGHT_HELP_PATH}>Learn about copyright, strikes and counter-notices</Link></p>
      <AppealStrikeDialog strike={appealTarget} onClose={() => setAppealTarget(null)} />
      <AppealDecisionDialog decision={decisionTarget} onClose={() => setDecisionTarget(null)} />
      <CounterNoticeDialog notice={counterTarget} onClose={() => setCounterTarget(null)} />
    </>
  );
}

export function StandingSummary({ health, compact = false }: { readonly health: AccountHealth; readonly compact?: boolean }) {
  return (
    <section className={rowStyles.row} aria-label="Account standing">
      <div className={rowStyles.top}>
        <strong>Account status</strong>
        <Badge tone={standingTone[health.status]}>{describeAccountStanding(health.status)}</Badge>
      </div>
      <span className={rowStyles.meta}>{health.activeStrikeCount} of {health.restrictionThreshold} active strikes · strikes expire after {health.strikeLifetimeDays} days{health.pendingTakedownCount > 0 ? ` · ${health.pendingTakedownCount} takedown deadline pending` : ""}</span>
      {health.restrictions.length > 0 ? <span className={rowStyles.meta}>Paused: {health.restrictions.map(describeRestriction).join(", ")}</span> : null}
      {compact ? <Link href="/settings/account-status">View account status</Link> : null}
    </section>
  );
}

function StrikeList({ title, empty, items, onAppeal }: { readonly title: string; readonly empty: string; readonly items: readonly AccountStrike[]; readonly onAppeal: (strike: AccountStrike) => void }) {
  return (
    <section className={settingsStyles.block}>
      <h2 className={settingsStyles.blockHeading}>{title}</h2>
      {items.length === 0 ? <p className={rowStyles.meta}>{empty}</p> : (
        <ul className={rowStyles.list}>
          {items.map((strike) => (
            <li key={strike.id} className={rowStyles.row}>
              <div className={rowStyles.top}><strong>{strike.policy}</strong>{strike.appealStatus === "PENDING" ? <span className={rowStyles.status}>Appeal under review</span> : null}</div>
              <span className={rowStyles.meta}>{strike.reason}</span>
              <span className={rowStyles.meta}>Issued {formatDate(strike.issuedAt)} · Expires {formatDate(strike.expiresAt)}{strike.affectedContent ? ` · ${contentLabel(strike.affectedContent)}` : ""}</span>
              {strike.canAppeal ? <div><Button variant="secondary" onClick={() => onAppeal(strike)}>Appeal</Button></div> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ModerationDecisionList({ items, onAppeal }: { readonly items: readonly ModerationDecision[]; readonly onAppeal: (decision: ModerationDecision) => void }) {
  return (
    <section className={settingsStyles.block}>
      <h2 className={settingsStyles.blockHeading}>Content decisions</h2>
      {items.length === 0 ? <p className={rowStyles.meta}>No recent content moderation decisions.</p> : (
        <ul className={rowStyles.list}>
          {items.map((decision) => (
            <li key={decision.reportId} className={rowStyles.row}>
              <div className={rowStyles.top}>
                <strong>{contentLabel(decision.target)}</strong>
                {decision.appeal ? <span className={rowStyles.status}>Appeal {decision.appeal.status.toLowerCase()}</span> : null}
              </div>
              <span className={rowStyles.meta}>{decision.reason}</span>
              <span className={rowStyles.meta}>Decided {formatDate(decision.decidedAt)}</span>
              {decision.appealable && !decision.appeal ? <div><Button variant="secondary" onClick={() => onAppeal(decision)}>Appeal decision</Button></div> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
