"use client";

import Link from "next/link";
import { useState } from "react";

import { AuditHistoryList } from "@/components/audit/auditHistoryList";
import { Button } from "@/components/ui/button";
import { ErrorBlock, LoadingBlock, NoticeBanner } from "@/components/ui/feedback";
import { SidePanel } from "@/components/ui/sidePanel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { KeyValueList, SectionHeading } from "@/components/ui/surfaces";
import { useToast } from "@/components/ui/toastProvider";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchLiveIncidentDetail } from "@/services/liveIncidentsApi.service";
import type { LiveIncidentAction, LiveIncidentDetail } from "@/types/liveIncident.type";
import { formatDateTime, formatRelativeTimeFromNow, humanizeConstantName } from "@/utils/formatting.util";

import { LiveIncidentActionDialog, liveIncidentActionPresentations } from "./liveIncidentActionDialog";
import { LiveIncidentFrameGrid } from "./liveIncidentFrames";
import styles from "./liveIncidents.module.css";

const actionOrder: readonly LiveIncidentAction[] = ["keep_live", "keep_paused", "end_live", "end_and_suspend"];

function formatOffset(offsetSeconds: number | null): string {
  if (offsetSeconds === null) return "time unknown";
  const minutes = Math.floor(offsetSeconds / 60);
  return `${minutes}:${String(Math.floor(offsetSeconds % 60)).padStart(2, "0")} into the live`;
}

export function LiveIncidentDetailPanel({ incidentId, onClose, onIncidentChanged }: { readonly incidentId: string | null; readonly onClose: () => void; readonly onIncidentChanged: () => void }) {
  const { data: incident, errorMessage, isLoading, reload, replaceData } = useAdminQuery((signal) => fetchLiveIncidentDetail(incidentId ?? "", signal), incidentId ?? "", incidentId !== null);
  const [pendingAction, setPendingAction] = useState<LiveIncidentAction | null>(null);
  const { showToast } = useToast();
  const isOpen = incident?.status === "open";

  function handleCompleted(updated: LiveIncidentDetail, action: LiveIncidentAction) {
    replaceData(() => updated);
    setPendingAction(null);
    showToast(`${liveIncidentActionPresentations[action].confirmLabel}: done. Logged to the audit trail.`);
    onIncidentChanged();
  }

  return (
    <SidePanel
      isOpen={incidentId !== null}
      onClose={onClose}
      width="wide"
      title={incident ? `Live ${incident.liveId}` : "Live incident"}
      subtitle={incident ? <>{incident.id} · opened {formatRelativeTimeFromNow(incident.createdAt)} · respond by {formatDateTime(incident.slaDueAt)}</> : null}
      footer={
        incident && isOpen
          ? actionOrder
              .filter((action) => !(action === "end_live" || action === "end_and_suspend") || !incident.liveEnded)
              .map((action) => (
                <Button key={action} size="small" variant={liveIncidentActionPresentations[action].isDestructive ? "quietDanger" : "secondary"} iconName={liveIncidentActionPresentations[action].requiresStepUp ? "shield24" : undefined} onClick={() => setPendingAction(action)}>
                  {liveIncidentActionPresentations[action].confirmLabel}
                </Button>
              ))
          : null
      }
    >
      {errorMessage ? <ErrorBlock message={errorMessage} onRetry={reload} /> : null}
      {isLoading && !incident ? <LoadingBlock /> : null}
      {incident ? (
        <>
          {incident.hashMatch ? (
            <NoticeBanner tone="danger" title="Possible child sexual abuse material">
              A hash-matching provider flagged this live. Evidence was preserved for the legal team. Do not download, copy or share frames. Escalate to legal before closing.
            </NoticeBanner>
          ) : null}
          {incident.holdActive ? (
            <NoticeBanner tone="caution" title={`Paused for viewers by ${incident.holdSource === "moderator" ? "a moderator" : "automated checks"}`}>
              {incident.holdReason} · since {formatDateTime(incident.holdStartedAt)}
            </NoticeBanner>
          ) : null}
          {incident.decision ? (
            <NoticeBanner tone="info" title={`${humanizeConstantName(incident.decision.action)} by ${incident.decision.decidedByName}`}>
              {incident.decision.reason} · {formatDateTime(incident.decision.decidedAt)}
            </NoticeBanner>
          ) : null}
          <div className={styles.section}>
            <SectionHeading actions={<Link href={`/users/${incident.host.id}`}>Open host profile</Link>}>Overview</SectionHeading>
            <KeyValueList columns={3} items={[
              { label: "Priority", value: <StatusBadge status={incident.priority.toUpperCase()} /> },
              { label: "Host", value: incident.host.username ? `@${incident.host.username}` : incident.host.id },
              { label: "Live", value: incident.liveEnded ? "Ended" : "On air" },
              { label: "Top signal", value: incident.topCategory ? `${humanizeConstantName(incident.topCategory)} ${Math.round(incident.topConfidence * 100)}%` : "None" },
              { label: "Reports", value: incident.reportCount },
              { label: "Host warnings", value: incident.warningCount },
            ]} />
          </div>
          {incident.appealedAt ? (
            <div className={styles.section}>
              <SectionHeading>Host appeal</SectionHeading>
              <p className={styles.noteItem}>{incident.appealMessage || "The host appealed without a message."}</p>
              <p className={styles.muted}>Appealed {formatRelativeTimeFromNow(incident.appealedAt)}</p>
            </div>
          ) : null}
          <div className={styles.section}>
            <SectionHeading>Latest frames</SectionHeading>
            <LiveIncidentFrameGrid frames={incident.latestFrames} emptyMessage="No frames sampled yet." />
          </div>
          <div className={styles.section}>
            <SectionHeading>Flagged frames</SectionHeading>
            <LiveIncidentFrameGrid frames={incident.flaggedFrames} emptyMessage="No frames were flagged by automated checks." />
          </div>
          <div className={styles.section}>
            <SectionHeading>Transcript</SectionHeading>
            {incident.transcripts.length === 0 ? <p className={styles.muted}>No transcript segments for this live.</p> : (
              <ul className={styles.plainList}>
                {incident.transcripts.map((segment) => (
                  <li key={segment.id} className={styles.noteItem}>
                    <q>{segment.snippet}</q>
                    <p className={styles.muted}>{segment.categories.map((category) => `${humanizeConstantName(category.category)} ${Math.round(category.confidence * 100)}%`).join(" · ") || "No categories"} · {formatRelativeTimeFromNow(segment.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className={styles.section}>
            <SectionHeading>Reports from viewers</SectionHeading>
            {incident.reports.length === 0 ? <p className={styles.muted}>No viewer reports.</p> : (
              <ul className={styles.plainList}>
                {incident.reports.map((report) => (
                  <li key={report.id} className={styles.noteItem}>
                    <strong>{humanizeConstantName(report.reason)}</strong>{report.details ? ` · ${report.details}` : ""}
                    <p className={styles.muted}>{formatOffset(report.offsetSeconds)} · {formatRelativeTimeFromNow(report.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className={styles.section}>
            <SectionHeading>History</SectionHeading>
            <AuditHistoryList entries={incident.history} />
          </div>
          <LiveIncidentActionDialog incident={incident} action={pendingAction} onClose={() => setPendingAction(null)} onCompleted={handleCompleted} />
        </>
      ) : null}
    </SidePanel>
  );
}
