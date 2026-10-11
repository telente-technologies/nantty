"use client";

import Link from "next/link";
import { useState } from "react";

import { useAdminPermissions } from "@/components/session/adminSessionProvider";
import { Button } from "@/components/ui/button";
import { ErrorBlock, LoadingBlock, NoticeBanner } from "@/components/ui/feedback";
import { SidePanel } from "@/components/ui/sidePanel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { KeyValueList, SectionHeading } from "@/components/ui/surfaces";
import { useToast } from "@/components/ui/toastProvider";
import { UserIdentity } from "@/components/ui/userIdentity";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchSecurityCaseDetail } from "@/services/securityCasesApi.service";
import type { AdminPermission } from "@/constants/adminPermissions.constant";
import type { SecurityCaseAction, SecurityCaseDetail, SecurityTimelineEntry } from "@/types/securityCases.type";
import { formatDateTime, formatRelativeTimeFromNow, humanizeConstantName } from "@/utils/formatting.util";

import { SecurityCaseActionDialog, securityActionLabels } from "./securityCaseActionDialog";
import styles from "./trustShared.module.css";

const actionOrder: readonly { action: SecurityCaseAction; permission: AdminPermission; variant: "ghost" | "secondary" | "quietDanger" }[] = [
  { action: "clear", permission: "security:cases", variant: "ghost" },
  { action: "keep_restricted", permission: "users:restrict", variant: "secondary" },
  { action: "suspend", permission: "users:suspend", variant: "quietDanger" },
  { action: "ban", permission: "users:ban", variant: "quietDanger" },
  { action: "delete", permission: "users:delete", variant: "quietDanger" },
];

function describeEntry(entry: SecurityTimelineEntry): string {
  const detail = entry.detail ?? {};
  const read = (key: string) => (detail[key] === undefined || detail[key] === null ? "" : String(detail[key]));
  switch (entry.kind) {
    case "access_violation": return `${humanizeConstantName(read("kind"))} on ${read("routeTemplate")} (${read("windowCount")} in ${Math.round(Number(read("windowSeconds")) / 60)} min, threshold ${read("threshold")})`;
    case "challenge_failed": return `Failed the human check${read("errorCodes") ? ` (${read("errorCodes")})` : ""}`;
    case "challenge_passed": return "Passed the human check";
    case "challenge_required": return "Human check required on the next sensitive action";
    case "bot_score_recorded": return `Bot score ${read("score")} from ${read("modelVersion")}`;
    case "bot_marked": return `Marked as a suspected bot (${read("reasons")})`;
    case "auto_suspended": return `Suspended automatically for ${read("durationDays")} days`;
    default: return humanizeConstantName(entry.kind);
  }
}

export function SecurityCasePanel({ caseId, onClose, onChanged }: { readonly caseId: string; readonly onClose: () => void; readonly onChanged: () => void }) {
  const { data: securityCase, errorMessage, error: queryError, isLoading, reload, replaceData } = useAdminQuery((signal) => fetchSecurityCaseDetail(caseId, signal), caseId);
  const [pendingAction, setPendingAction] = useState<SecurityCaseAction | null>(null);
  const { showToast } = useToast();
  const { can } = useAdminPermissions();

  function handleCompleted(updated: SecurityCaseDetail, action: SecurityCaseAction) {
    replaceData(() => updated);
    setPendingAction(null);
    showToast(`${securityActionLabels[action]}: done. Logged to the audit trail.`);
    onChanged();
  }

  const footer = securityCase?.status === "open" ? actionOrder.filter((item) => can(item.permission)).map((item) => (
    <Button key={item.action} size="small" variant={item.variant} iconName="shield24" onClick={() => setPendingAction(item.action)}>{securityActionLabels[item.action]}</Button>
  )) : null;

  return (
    <SidePanel isOpen onClose={onClose} width="wide" title={securityCase ? `Security case · ${humanizeConstantName(securityCase.trigger)}` : "Security case"} subtitle={securityCase ? `${securityCase.id} · opened ${formatRelativeTimeFromNow(securityCase.openedAt)}` : null} footer={footer}>
      {errorMessage ? <ErrorBlock error={queryError} message={errorMessage} onRetry={reload} /> : null}
      {isLoading && !securityCase ? <LoadingBlock /> : null}
      {securityCase ? (
        <>
          <NoticeBanner tone={securityCase.autoSuspended ? "danger" : "info"} title={securityCase.autoSuspended ? "Suspended automatically after repeated failures" : "Automation only flags and challenges"}>{securityCase.automationNote}</NoticeBanner>
          {securityCase.decision ? <NoticeBanner tone="success" title={`${humanizeConstantName(securityCase.decision.outcome)} by ${securityCase.decision.decidedByName}`}>{securityCase.decision.reason} · {formatDateTime(securityCase.decision.decidedAt)}</NoticeBanner> : null}
          <div className={styles.section}>
            <SectionHeading actions={<Link href={`/users/${securityCase.accountId}`}>Open profile</Link>}>Account</SectionHeading>
            <UserIdentity user={securityCase.account} size={36} />
            <KeyValueList columns={3} items={[
              { label: "Account status", value: <StatusBadge status={securityCase.account.status ?? "ACTIVE"} /> },
              { label: "Severity", value: <StatusBadge label={humanizeConstantName(securityCase.severity)} tone={securityCase.severity === "high" ? "danger" : securityCase.severity === "medium" ? "caution" : "neutral"} /> },
              { label: "Previous cases", value: securityCase.previousCases },
              { label: "Violations", value: securityCase.violationCount },
              { label: "Checks passed / failed", value: `${securityCase.passedChallengeCount} / ${securityCase.failedChallengeCount}` },
              { label: "Bot score", value: securityCase.state.suspectedBot || securityCase.state.botScore > 0 ? securityCase.state.botScore.toFixed(2) : "—" },
            ]} />
            {securityCase.state.botReasons.length > 0 ? <p className={styles.noteMeta}>Bot signals: {securityCase.state.botReasons.map(humanizeConstantName).join(" · ")}</p> : null}
          </div>
          <div className={styles.section}>
            <SectionHeading>Linked devices and networks</SectionHeading>
            <KeyValueList columns={2} items={[{ label: "Devices", value: securityCase.linkedDevices.join(", ") || "—" }, { label: "Network prefixes", value: securityCase.linkedIpPrefixes.join(", ") || "—" }]} />
          </div>
          <div className={styles.section}>
            <SectionHeading>Challenge history ({securityCase.challengeHistory.length})</SectionHeading>
            {securityCase.challengeHistory.length === 0 ? <p className={styles.muted}>No human checks yet.</p> : (
              <ul className={styles.plainList}>{securityCase.challengeHistory.map((entry) => <li key={entry.id} className={styles.noteItem}>{describeEntry(entry)}<p className={styles.noteMeta}>{formatDateTime(entry.at)} · {entry.deviceId || "unknown device"}</p></li>)}</ul>
            )}
          </div>
          <div className={styles.section}>
            <SectionHeading>Evidence timeline</SectionHeading>
            <ul className={styles.plainList}>{securityCase.timeline.map((entry) => <li key={entry.id} className={styles.noteItem}><strong>{humanizeConstantName(entry.kind)}</strong> — {describeEntry(entry)}<p className={styles.noteMeta}>{formatDateTime(entry.at)} · {entry.source}{entry.ipPrefix ? ` · ${entry.ipPrefix}` : ""}</p></li>)}</ul>
          </div>
          <SecurityCaseActionDialog securityCase={securityCase} action={pendingAction} onClose={() => setPendingAction(null)} onCompleted={handleCompleted} />
        </>
      ) : null}
    </SidePanel>
  );
}
